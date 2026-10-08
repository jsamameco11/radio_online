<?php

namespace App\Domain\Payments\Gateways;

use App\Domain\Payments\CardGateway;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateway;
use App\Domain\Payments\Support\CardCharge;
use App\Domain\Payments\Support\CardHolder;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Domain\Payments\Support\ChargeResult;
use App\Domain\Payments\Support\SavedCard;
use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Test gateway for development: the top-up page offers a "simular pago"
 * button instead of a card form and every charge is approved. It refuses to
 * work in production.
 *
 * Saved cards: the token "sandbox_declined" registers a card that the bank
 * will refuse when charged, to rehearse a failed payment.
 */
final class SandboxGateway implements CardGateway, PaymentGateway
{
    public const DECLINED_TOKEN = 'sandbox_declined';

    private const DECLINED_CARD = 'sandbox_crd_declined_';

    public function name(): string
    {
        return 'sandbox';
    }

    public function isSandbox(): bool
    {
        return true;
    }

    public function ensureAvailable(): void
    {
        if (app()->isProduction()) {
            throw PaymentUnavailable::sandboxInProduction();
        }
    }

    public function checkout(Payment $payment): array
    {
        $this->ensureAvailable();

        return [
            'amount_cents' => $payment->amount_cents,
            'currency' => $payment->currency,
        ];
    }

    public function charge(Payment $payment, ChargeAttempt $attempt): ChargeResult
    {
        $this->ensureAvailable();

        return ChargeResult::succeeded('sandbox_'.$payment->id);
    }

    public function refund(Payment $payment, string $reason): string
    {
        $this->ensureAvailable();

        return 'sandbox_refund_'.Str::lower(Str::random(16));
    }

    public function cardCheckout(): array
    {
        $this->ensureAvailable();

        return [];
    }

    public function saveCard(CardHolder $holder, string $token, ?array $authentication3ds = null): SavedCard
    {
        $this->ensureAvailable();

        $declined = $token === self::DECLINED_TOKEN;

        return new SavedCard(
            'sandbox_cus_'.md5($holder->email),
            ($declined ? self::DECLINED_CARD : 'sandbox_crd_').Str::lower(Str::random(12)),
            'Visa',
            $declined ? '0002' : '4242',
        );
    }

    public function chargeCard(CardCharge $charge): ChargeResult
    {
        $this->ensureAvailable();

        if (str_starts_with($charge->source, self::DECLINED_CARD) || $charge->source === self::DECLINED_TOKEN) {
            return ChargeResult::declined('Fondos insuficientes (simulado). Prueba con otra tarjeta.', ['card_brand' => 'Visa', 'card_last_four' => '0002']);
        }

        return ChargeResult::succeeded('sandbox_chr_'.Str::lower(Str::random(16)), ['card_brand' => 'Visa', 'card_last_four' => '4242']);
    }

    public function forgetCard(string $cardId): void {}
}
