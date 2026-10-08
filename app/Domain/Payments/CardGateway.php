<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Exceptions\AuthenticationRequired;
use App\Domain\Payments\Exceptions\CardDeclined;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\Support\CardCharge;
use App\Domain\Payments\Support\CardHolder;
use App\Domain\Payments\Support\ChargeResult;
use App\Domain\Payments\Support\SavedCard;

/**
 * Cards kept on file with the processor, charged later from the backend
 * (a priced frequency is paid only when the staff approves the request).
 * Card numbers never reach our servers: the browser turns them into a token.
 */
interface CardGateway
{
    public function name(): string;

    public function isSandbox(): bool;

    /**
     * What the browser needs to tokenize a card (public key, title…).
     *
     * @return array<string, mixed>
     *
     * @throws PaymentUnavailable
     */
    public function cardCheckout(): array;

    /**
     * Registers the tokenized card for the holder.
     *
     * @param  array<string, string>|null  $authentication3ds
     *
     * @throws AuthenticationRequired the issuer wants 3-D Secure; send the same token again with it
     * @throws CardDeclined
     * @throws PaymentUnavailable
     */
    public function saveCard(CardHolder $holder, string $token, ?array $authentication3ds = null): SavedCard;

    /**
     * Charges a saved card or a fresh token.
     *
     * @throws ChargePending the processor did not answer: the charge may have happened
     * @throws PaymentUnavailable
     */
    public function chargeCard(CardCharge $charge): ChargeResult;

    /** Best effort: the card is no longer needed. */
    public function forgetCard(string $cardId): void;
}
