<?php

namespace App\Http\Requests\Concerns;

use App\Domain\Monetization\Enums\PayoutMethod;
use Illuminate\Validation\Rule;

/** Where the platform sends money to someone: method, holder, account and, for bank transfers, the bank. */
trait ValidatesPayoutDetails
{
    /**
     * @return array<string, mixed>
     */
    protected function payoutRules(): array
    {
        $method = $this->payoutMethod();

        return [
            'payout_method' => ['required', Rule::enum(PayoutMethod::class)],
            'holder' => ['required', 'string', 'min:3', 'max:120'],
            'account' => ['required', 'string', 'max:120', ...($method?->accountRules() ?? [])],
            'bank' => [Rule::requiredIf($method === PayoutMethod::BankTransfer), 'nullable', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function payoutMessages(): array
    {
        return [
            'payout_method.*' => 'Elige cómo quieres recibir tu dinero.',
            'holder.*' => 'Escribe el nombre completo del titular.',
            'account.regex' => match ($this->payoutMethod()) {
                PayoutMethod::Yape, PayoutMethod::Plin => 'Escribe un celular peruano de 9 dígitos que empiece con 9.',
                default => 'Revisa el número de cuenta: solo dígitos y guiones.',
            },
            'account.email' => 'Escribe un correo de PayPal válido.',
            'account.*' => 'Completa los datos de la cuenta.',
            'bank.*' => 'Escribe el nombre del banco.',
        ];
    }

    public function payoutMethod(): ?PayoutMethod
    {
        return PayoutMethod::tryFrom((string) $this->input('payout_method'));
    }

    /**
     * @return array{holder: string, account: string, bank: ?string}
     */
    public function details(): array
    {
        return [
            'holder' => trim((string) $this->validated('holder')),
            'account' => trim((string) $this->validated('account')),
            'bank' => $this->filled('bank') ? trim((string) $this->validated('bank')) : null,
        ];
    }
}
