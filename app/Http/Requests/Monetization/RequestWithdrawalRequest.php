<?php

namespace App\Http\Requests\Monetization;

use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Estudio > Monetización > Retirar: amount in cents and where to send it. Owner only. */
class RequestWithdrawalRequest extends FormRequest
{
    public function authorize(CurrentStation $current): bool
    {
        return $this->user()->canInStation($current->get(), StationPermission::WithdrawEarnings);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $method = PayoutMethod::tryFrom((string) $this->input('payout_method'));

        return [
            'amount_cents' => ['required', 'integer', 'min:'.(int) config('platform.monetization.min_withdrawal_cents'), 'max:100000000'],
            'payout_method' => ['required', Rule::enum(PayoutMethod::class)],
            'holder' => ['required', 'string', 'min:3', 'max:120'],
            'account' => ['required', 'string', 'max:120', ...($method?->accountRules() ?? [])],
            'bank' => [Rule::requiredIf($method === PayoutMethod::BankTransfer), 'nullable', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $minimum = number_format((int) config('platform.monetization.min_withdrawal_cents') / 100, 2);

        return [
            'amount_cents.min' => "El retiro mínimo es de US$ {$minimum}.",
            'amount_cents.*' => 'Escribe un monto válido.',
            'payout_method.*' => 'Elige cómo quieres recibir tu dinero.',
            'holder.*' => 'Escribe el nombre completo del titular.',
            'account.regex' => match (PayoutMethod::tryFrom((string) $this->input('payout_method'))) {
                PayoutMethod::Yape, PayoutMethod::Plin => 'Escribe un celular peruano de 9 dígitos que empiece con 9.',
                default => 'Revisa el número de cuenta: solo dígitos y guiones.',
            },
            'account.email' => 'Escribe un correo de PayPal válido.',
            'account.*' => 'Completa los datos de la cuenta.',
            'bank.*' => 'Escribe el nombre del banco.',
        ];
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
