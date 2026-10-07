<?php

namespace App\Domain\Payments\Exceptions;

use App\Domain\Wallet\Exceptions\WalletException;

final class PaymentUnavailable extends WalletException
{
    public static function notConfigured(): self
    {
        return new self('Los pagos con tarjeta no están disponibles en este momento.');
    }

    public static function sandboxInProduction(): self
    {
        return new self('El modo de prueba de pagos no está disponible.');
    }

    public static function providerError(): self
    {
        return new self('No pudimos comunicarnos con la pasarela de pago. Inténtalo de nuevo en unos minutos.');
    }

    public static function accountSuspended(): self
    {
        return new self('Tu cuenta está suspendida y no puede recargar saldo.');
    }

    public function reason(): string
    {
        return 'payment_unavailable';
    }
}
