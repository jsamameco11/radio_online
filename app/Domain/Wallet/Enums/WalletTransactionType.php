<?php

namespace App\Domain\Wallet\Enums;

enum WalletTransactionType: string
{
    case Deposit = 'deposit';
    case GiftPurchase = 'gift_purchase';
    case GiftEarning = 'gift_earning';
    case Refund = 'refund';
    case AdminAdjustment = 'admin_adjustment';
    case Withdrawal = 'withdrawal';

    public function label(): string
    {
        return match ($this) {
            self::Deposit => 'Recarga',
            self::GiftPurchase => 'Regalo enviado',
            self::GiftEarning => 'Regalo recibido',
            self::Refund => 'Reembolso',
            self::AdminAdjustment => 'Ajuste administrativo',
            self::Withdrawal => 'Retiro',
        };
    }
}
