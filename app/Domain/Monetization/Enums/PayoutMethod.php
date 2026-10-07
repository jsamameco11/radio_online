<?php

namespace App\Domain\Monetization\Enums;

/** Where the platform sends the money of a withdrawal. */
enum PayoutMethod: string
{
    case BankTransfer = 'bank_transfer';
    case Yape = 'yape';
    case Plin = 'plin';
    case PayPal = 'paypal';

    public function label(): string
    {
        return match ($this) {
            self::BankTransfer => 'Transferencia bancaria',
            self::Yape => 'Yape',
            self::Plin => 'Plin',
            self::PayPal => 'PayPal',
        };
    }

    /** What the "account" field holds for this method. */
    public function accountLabel(): string
    {
        return match ($this) {
            self::BankTransfer => 'Número de cuenta o CCI',
            self::Yape, self::Plin => 'Número de celular',
            self::PayPal => 'Correo de PayPal',
        };
    }

    public function needsBank(): bool
    {
        return $this === self::BankTransfer;
    }

    /**
     * Validation rules of the "account" field.
     *
     * @return list<string>
     */
    public function accountRules(): array
    {
        return match ($this) {
            self::BankTransfer => ['regex:/^[0-9][0-9\- ]{8,28}[0-9]$/'],
            self::Yape, self::Plin => ['regex:/^9\d{8}$/'],
            self::PayPal => ['email:rfc', 'max:120'],
        };
    }

    /** "Yape · ···· 4321": enough to recognize the destination without exposing it. */
    public function mask(string $account): string
    {
        $visible = $this === self::PayPal
            ? mb_substr($account, 0, 2).'···@'.(explode('@', $account)[1] ?? '')
            : '···· '.mb_substr(preg_replace('/\D/', '', $account) ?? '', -4);

        return $this->label().' · '.$visible;
    }
}
