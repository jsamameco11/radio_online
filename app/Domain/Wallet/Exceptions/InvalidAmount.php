<?php

namespace App\Domain\Wallet\Exceptions;

final class InvalidAmount extends WalletException
{
    public static function notPositive(): self
    {
        return new self('El monto debe ser mayor que cero.');
    }

    public static function zero(): self
    {
        return new self('El monto del ajuste no puede ser cero.');
    }

    public static function depositOutOfRange(int $minCents, int $maxCents): self
    {
        return new self(sprintf(
            'La recarga debe ser de al menos US$ %s y como máximo US$ %s.',
            number_format($minCents / 100, 2),
            number_format($maxCents / 100, 2),
        ));
    }

    public static function feeOutOfRange(): self
    {
        return new self('La comisión no puede superar el monto de la operación.');
    }

    public function reason(): string
    {
        return 'invalid_amount';
    }
}
