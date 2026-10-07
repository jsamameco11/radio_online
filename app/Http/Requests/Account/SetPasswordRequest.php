<?php

namespace App\Http\Requests\Account;

use App\Actions\Fortify\PasswordValidationRules;
use Illuminate\Foundation\Http\FormRequest;

/** A first password for an account created with Google; changing one goes through Fortify. */
class SetPasswordRequest extends FormRequest
{
    use PasswordValidationRules;

    public function authorize(): bool
    {
        return $this->user()?->getAuthPassword() === null;
    }

    public function rules(): array
    {
        return ['password' => $this->passwordRules()];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Escribe tu nueva contraseña.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ];
    }
}
