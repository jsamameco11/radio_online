<?php

namespace App\Domain\Frequencies\Enums;

enum FrequencyPaymentStatus: string
{
    /** The request was sent but the applicant has not registered a card yet. */
    case CardRequired = 'card_required';
    /** Card on file: it is charged when the staff approves the request. */
    case CardSaved = 'card_saved';
    case Paid = 'paid';
    /** The card was declined when approving; the applicant can pay with another one. */
    case Failed = 'failed';
    /** The processor did not answer: the charge may or may not have happened. */
    case Unconfirmed = 'unconfirmed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::CardRequired => 'Falta registrar la tarjeta',
            self::CardSaved => 'Tarjeta registrada',
            self::Paid => 'Pagada',
            self::Failed => 'Pago rechazado',
            self::Unconfirmed => 'Pago sin confirmar',
            self::Cancelled => 'Cancelado',
        };
    }

    /** States in which the staff (or the applicant) still has to act on the money. */
    public function needsAttention(): bool
    {
        return in_array($this, [self::CardRequired, self::Failed, self::Unconfirmed], true);
    }
}
