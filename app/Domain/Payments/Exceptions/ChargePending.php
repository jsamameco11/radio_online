<?php

namespace App\Domain\Payments\Exceptions;

use App\Domain\Wallet\Exceptions\WalletException;

/**
 * The charge may have gone through but we could not confirm it. The payment
 * stays pending and takes no other card until the provider settles it.
 */
final class ChargePending extends WalletException
{
    public static function unconfirmed(): self
    {
        return new self('No pudimos confirmar el pago con tu banco. Si se realizó el cobro, lo acreditaremos automáticamente en unos minutos: no vuelvas a pagar esta recarga.');
    }

    public static function inProgress(): self
    {
        return new self('Ya estamos procesando este pago. Espera unos segundos.');
    }

    public function reason(): string
    {
        return 'charge_pending';
    }
}
