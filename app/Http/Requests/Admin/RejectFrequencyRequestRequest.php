<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Admin > Solicitudes > Rechazar: the note is sent to the requester. */
class RejectFrequencyRequestRequest extends FormRequest
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
        return ['note' => ['required', 'string', 'min:5', 'max:500']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['note.*' => 'Explica el motivo del rechazo (entre 5 y 500 caracteres): se lo enviaremos a quien lo pidió.'];
    }
}
