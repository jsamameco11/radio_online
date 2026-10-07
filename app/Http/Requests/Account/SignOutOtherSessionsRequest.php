<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class SignOutOtherSessionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'current_password:web'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Escribe tu contraseña para confirmar.',
            'password.current_password' => 'La contraseña no es correcta.',
        ];
    }
}
