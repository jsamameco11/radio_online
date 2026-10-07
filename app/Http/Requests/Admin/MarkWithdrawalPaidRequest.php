<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Admin > Retiros > Marcar como pagado: the transfer reference and an optional note. */
class MarkWithdrawalPaidRequest extends FormRequest
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
            'reference' => ['required', 'string', 'min:3', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['reference.*' => 'Escribe la referencia de la transferencia (entre 3 y 120 caracteres).'];
    }
}
