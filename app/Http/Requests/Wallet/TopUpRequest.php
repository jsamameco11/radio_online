<?php

namespace App\Http\Requests\Wallet;

use Illuminate\Foundation\Http\FormRequest;

class TopUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount_cents' => [
                'required',
                'integer',
                'min:'.config('platform.wallet.min_deposit_cents'),
                'max:'.config('platform.wallet.max_deposit_cents'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $min = number_format(config('platform.wallet.min_deposit_cents') / 100, 2);
        $max = number_format(config('platform.wallet.max_deposit_cents') / 100, 2);

        return [
            'amount_cents.required' => 'Elige cuánto quieres recargar.',
            'amount_cents.integer' => 'El monto no es válido.',
            'amount_cents.min' => "La recarga mínima es de US$ {$min}.",
            'amount_cents.max' => "La recarga máxima es de US$ {$max}.",
        ];
    }
}
