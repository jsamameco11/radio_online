<?php

namespace App\Http\Requests\Monetization;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Requests\Concerns\ValidatesPayoutDetails;
use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Monetización > Retirar: amount in cents and where to send it. Owner only. */
class RequestWithdrawalRequest extends FormRequest
{
    use ValidatesPayoutDetails;

    public function authorize(CurrentStation $current): bool
    {
        return $this->user()->canInStation($current->get(), StationPermission::WithdrawEarnings);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount_cents' => ['required', 'integer', 'min:'.(int) config('platform.monetization.min_withdrawal_cents'), 'max:100000000'],
            ...$this->payoutRules(),
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
            ...$this->payoutMessages(),
        ];
    }
}
