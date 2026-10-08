<?php

namespace App\Domain\Payments\Gateways;

use App\Domain\Payments\CardGateway;
use App\Domain\Payments\Exceptions\AuthenticationRequired;
use App\Domain\Payments\Exceptions\CardDeclined;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentNotRefundable;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateway;
use App\Domain\Payments\Support\CardCharge;
use App\Domain\Payments\Support\CardHolder;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Domain\Payments\Support\ChargeResult;
use App\Domain\Payments\Support\SavedCard;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Culqi (Peru). Culqi Checkout v4 turns the card into a token in the browser;
 * the backend charges it through POST /v2/charges with the secret key. When
 * the issuer asks for 3-D Secure, Culqi answers action_code "REVIEW" and the
 * browser runs Culqi3DS before the same token is charged again.
 *
 * Cards on file (priced frequencies): the token is attached to a Culqi
 * customer through POST /v2/cards and the card id is charged later.
 */
final class CulqiGateway implements CardGateway, PaymentGateway
{
    private const APPROVED = 'venta_exitosa';

    private const AUTHENTICATION = 'REVIEW';

    /** Culqi only accepts "duplicidad", "fraudulento" or "solicitud_comprador". */
    private const REFUND_REASON = 'solicitud_comprador';

    public function name(): string
    {
        return 'culqi';
    }

    public function isSandbox(): bool
    {
        return false;
    }

    public function ensureAvailable(): void
    {
        if ($this->key('public_key') === '' || $this->key('secret_key') === '') {
            throw PaymentUnavailable::notConfigured();
        }

        if (Str::upper((string) config('services.culqi.currency')) !== WalletLedger::currency()) {
            report(new RuntimeException('CULQI_CURRENCY must be the wallet currency ['.WalletLedger::currency().'].'));

            throw PaymentUnavailable::notConfigured();
        }
    }

    public function checkout(Payment $payment): array
    {
        $this->ensureAvailable();

        return [
            'public_key' => $this->key('public_key'),
            'amount_cents' => $payment->amount_cents,
            'currency' => $payment->currency,
            'title' => (string) config('platform.name'),
        ];
    }

    public function charge(Payment $payment, ChargeAttempt $attempt): ChargeResult
    {
        $this->ensureAvailable();

        return $this->postCharge([
            'amount' => $payment->amount_cents,
            'currency_code' => $payment->currency,
            'email' => $attempt->email,
            'source_id' => $attempt->token,
            'description' => $this->description('Recarga de billetera'),
            'metadata' => ['payment_id' => $payment->id, 'user_id' => (string) $payment->user_id],
            'authentication_3DS' => $attempt->authentication3ds,
        ], fn (array $charge) => $this->interpret($payment, $charge), "payment [{$payment->id}]");
    }

    public function cardCheckout(): array
    {
        $this->ensureAvailable();

        return [
            'public_key' => $this->key('public_key'),
            'title' => (string) config('platform.name'),
        ];
    }

    public function saveCard(CardHolder $holder, string $token, ?array $authentication3ds = null): SavedCard
    {
        $this->ensureAvailable();

        $customerId = $this->customerFor($holder);

        try {
            $response = $this->api()->post('cards', array_filter([
                'customer_id' => $customerId,
                'token_id' => $token,
                'validate' => true,
                'authentication_3DS' => $authentication3ds,
            ], fn ($value) => $value !== null));
        } catch (ConnectionException $exception) {
            report($exception);

            throw PaymentUnavailable::providerError();
        }

        $body = $this->body($response);

        if ($response->successful() && ($body['action_code'] ?? null) === self::AUTHENTICATION) {
            throw new AuthenticationRequired((string) ($body['user_message'] ?? '') ?: null);
        }

        if ($response->successful() && ($body['object'] ?? null) === 'card' && is_string($body['id'] ?? null)) {
            return new SavedCard(
                $customerId,
                $body['id'],
                $this->cardBrand(data_get($body, 'source.iin.card_brand')),
                $this->lastFour(data_get($body, 'source.last_four')),
            );
        }

        $this->rejectIfNotCharged($response);

        if (in_array($response->status(), [400, 402], true)) {
            throw new CardDeclined($this->message($body, 'Tu banco rechazó la tarjeta. Prueba con otra.'));
        }

        report(new RuntimeException("Culqi answered HTTP {$response->status()} when saving a card."));

        throw PaymentUnavailable::providerError();
    }

    public function chargeCard(CardCharge $charge): ChargeResult
    {
        $this->ensureAvailable();

        return $this->postCharge([
            'amount' => $charge->amountCents,
            'currency_code' => $charge->currency,
            'email' => $charge->email,
            'source_id' => $charge->source,
            'description' => $this->description($charge->description),
            'metadata' => $charge->metadata,
            'authentication_3DS' => $charge->authentication3ds,
        ], fn (array $body) => $this->verdict($body, $charge->amountCents, $charge->currency, 'the card charge'), 'a card charge');
    }

    public function forgetCard(string $cardId): void
    {
        if (! preg_match('/^crd_[A-Za-z0-9_]+$/', $cardId)) {
            return;
        }

        try {
            $this->api()->delete('cards/'.$cardId);
        } catch (ConnectionException $exception) {
            report($exception);
        }
    }

    public function refund(Payment $payment, string $reason): string
    {
        $this->ensureAvailable();

        if ($payment->provider_reference === null) {
            throw new PaymentNotRefundable;
        }

        try {
            $response = $this->api()->post('refunds', [
                'amount' => $payment->amount_cents,
                'charge_id' => $payment->provider_reference,
                'reason' => self::REFUND_REASON,
            ]);
        } catch (ConnectionException $exception) {
            report($exception);

            throw PaymentUnavailable::providerError();
        }

        $body = $this->body($response);

        if ($response->successful() && isset($body['id'])) {
            return (string) $body['id'];
        }

        $this->rejectIfNotCharged($response);

        if ($response->clientError()) {
            throw PaymentUnavailable::providerRejected(Str::limit((string) ($body['merchant_message'] ?? $body['user_message'] ?? 'sin detalle'), 200));
        }

        report(new RuntimeException("Culqi answered HTTP {$response->status()} to the refund of payment [{$payment->id}]."));

        throw PaymentUnavailable::providerError();
    }

    /**
     * Reads a charge straight from Culqi, the only source the webhook trusts.
     *
     * @return array<string, mixed>|null null when Culqi does not know the charge
     */
    public function retrieveCharge(string $chargeId): ?array
    {
        if (! preg_match('/^chr_[A-Za-z0-9_]+$/', $chargeId)) {
            return null;
        }

        try {
            $response = $this->api()->get('charges/'.$chargeId);
        } catch (ConnectionException $exception) {
            report($exception);

            throw ChargePending::unconfirmed();
        }

        $body = $this->body($response);

        if ($response->successful() && ($body['object'] ?? null) === 'charge') {
            return $body;
        }

        if (in_array($response->status(), [400, 404], true)) {
            return null;
        }

        $this->rejectIfNotCharged($response);

        throw ChargePending::unconfirmed();
    }

    /**
     * Turns a Culqi charge object into a verdict for this payment. A charge
     * for another amount or currency is never credited.
     *
     * @param  array<string, mixed>  $charge
     */
    public function interpret(Payment $payment, array $charge): ChargeResult
    {
        return $this->verdict($charge, $payment->amount_cents, $payment->currency, "payment [{$payment->id}]");
    }

    /**
     * A charge for another amount or currency than the expected one never counts as paid.
     *
     * @param  array<string, mixed>  $charge
     */
    private function verdict(array $charge, int $amountCents, string $currency, string $subject): ChargeResult
    {
        $meta = array_filter([
            'culqi_charge_id' => $charge['id'] ?? null,
            'culqi_reference_code' => $charge['reference_code'] ?? null,
            'card_brand' => data_get($charge, 'source.iin.card_brand'),
            'card_last_four' => data_get($charge, 'source.last_four'),
        ]);

        if (data_get($charge, 'outcome.type') !== self::APPROVED) {
            return ChargeResult::declined($this->message((array) ($charge['outcome'] ?? [])), $meta);
        }

        if ((int) ($charge['amount'] ?? 0) !== $amountCents
            || Str::upper((string) ($charge['currency_code'] ?? '')) !== $currency) {
            report(new RuntimeException('Culqi charge ['.($meta['culqi_charge_id'] ?? '?')."] does not match {$subject}."));

            return ChargeResult::declined('El cobro no coincide con el monto esperado. Nuestro equipo lo revisará.', $meta);
        }

        return ChargeResult::succeeded((string) $charge['id'], $meta);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  callable(array<string, mixed>): ChargeResult  $interpret
     */
    private function postCharge(array $payload, callable $interpret, string $subject): ChargeResult
    {
        try {
            $response = $this->api()->post('charges', array_filter($payload, fn ($value) => $value !== null));
        } catch (ConnectionException $exception) {
            report($exception);

            throw ChargePending::unconfirmed();
        }

        $body = $this->body($response);

        if ($response->successful() && ($body['action_code'] ?? null) === self::AUTHENTICATION) {
            return ChargeResult::requiresAuthentication((string) ($body['user_message'] ?? ''));
        }

        if ($response->successful() && ($body['object'] ?? null) === 'charge') {
            return $interpret($body);
        }

        if (in_array($response->status(), [400, 402], true)) {
            return ChargeResult::declined($this->message($body), array_filter([
                'culqi_charge_id' => $body['charge_id'] ?? null,
                'culqi_decline_code' => $body['decline_code'] ?? $body['code'] ?? null,
            ]));
        }

        $this->rejectIfNotCharged($response);
        report(new RuntimeException("Culqi answered HTTP {$response->status()} to the charge of {$subject}."));

        throw ChargePending::unconfirmed();
    }

    /** The holder's Culqi customer: the one already registered with that email, or a new one. */
    private function customerFor(CardHolder $holder): string
    {
        try {
            $found = $this->api()->get('customers', ['email' => $holder->email]);
            $existing = data_get($this->body($found), 'data.0.id');

            if ($found->successful() && is_string($existing)) {
                return $existing;
            }

            $response = $this->api()->post('customers', [
                'first_name' => Str::limit($holder->firstName, 50, ''),
                'last_name' => Str::limit($holder->lastName, 50, ''),
                'email' => $holder->email,
                'address' => Str::limit($holder->address, 100, ''),
                'address_city' => Str::limit($holder->city, 30, ''),
                'country_code' => $holder->countryCode,
                'phone_number' => Str::limit((string) preg_replace('/\D+/', '', $holder->phone), 15, ''),
            ]);
        } catch (ConnectionException $exception) {
            report($exception);

            throw PaymentUnavailable::providerError();
        }

        $body = $this->body($response);

        if ($response->successful() && is_string($body['id'] ?? null)) {
            return $body['id'];
        }

        $this->rejectIfNotCharged($response);

        if ($response->clientError()) {
            throw PaymentUnavailable::providerRejected(Str::limit((string) ($body['user_message'] ?? $body['merchant_message'] ?? 'sin detalle'), 200));
        }

        report(new RuntimeException("Culqi answered HTTP {$response->status()} when creating a customer."));

        throw PaymentUnavailable::providerError();
    }

    private function cardBrand(mixed $brand): ?string
    {
        return is_string($brand) && $brand !== '' ? Str::limit($brand, 30, '') : null;
    }

    private function lastFour(mixed $digits): ?string
    {
        return is_string($digits) && preg_match('/^\d{4}$/', $digits) === 1 ? $digits : null;
    }

    private function api(): PendingRequest
    {
        return Http::baseUrl((string) config('services.culqi.api_url'))
            ->withToken($this->key('secret_key'))
            ->acceptJson()
            ->asJson()
            ->connectTimeout(5)
            ->timeout((int) config('services.culqi.timeout'));
    }

    /** Wrong keys or too many requests: Culqi did not charge anything. */
    private function rejectIfNotCharged(Response $response): void
    {
        if (in_array($response->status(), [401, 403], true)) {
            report(new RuntimeException('Culqi rejected the secret key (HTTP '.$response->status().').'));

            throw PaymentUnavailable::notConfigured();
        }

        if ($response->status() === 429) {
            throw PaymentUnavailable::providerError();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function body(Response $response): array
    {
        $body = $response->json();

        return is_array($body) ? $body : [];
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function message(array $body, string $fallback = 'Tu banco rechazó el cargo. No se cobró nada.'): string
    {
        $message = $body['user_message'] ?? $body['merchant_message'] ?? null;

        return is_string($message) && $message !== '' ? Str::limit($message, 280) : $fallback;
    }

    private function description(string $concept): string
    {
        return Str::limit(Str::ascii($concept.' - '.config('platform.name')), 80, '');
    }

    private function key(string $name): string
    {
        return trim((string) config('services.culqi.'.$name));
    }
}
