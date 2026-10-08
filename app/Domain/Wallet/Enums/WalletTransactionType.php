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
    case WithdrawalReversal = 'withdrawal_reversal';
    case HighlightPurchase = 'highlight_purchase';
    case HighlightEarning = 'highlight_earning';
    case StationPurchase = 'station_purchase';
    case SaleSettlement = 'sale_settlement';

    public function label(): string
    {
        return match ($this) {
            self::Deposit => 'Recarga',
            self::GiftPurchase => 'Regalo enviado',
            self::GiftEarning => 'Regalo recibido',
            self::Refund => 'Reembolso',
            self::AdminAdjustment => 'Ajuste administrativo',
            self::Withdrawal => 'Retiro',
            self::WithdrawalReversal => 'Retiro devuelto',
            self::HighlightPurchase => 'Mensaje destacado enviado',
            self::HighlightEarning => 'Mensaje destacado recibido',
            self::StationPurchase => 'Compra de radio',
            self::SaleSettlement => 'Saldo liquidado al vendedor por la venta',
        };
    }
}
