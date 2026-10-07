<?php

namespace App\Domain\Payments\Exceptions;

use App\Domain\Wallet\Exceptions\WalletException;

final class PaymentNotRefundable extends WalletException
{
    public function __construct()
    {
        parent::__construct('Solo se pueden reembolsar recargas pagadas que aún no fueron reembolsadas.');
    }

    public function reason(): string
    {
        return 'payment_not_refundable';
    }
}
