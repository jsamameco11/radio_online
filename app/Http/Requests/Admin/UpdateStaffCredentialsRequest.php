<?php

namespace App\Http\Requests\Admin;

use App\Actions\Fortify\PasswordValidationRules;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Admin > Usuarios > Acceso al panel: the username and password of a staff account. */
class UpdateStaffCredentialsRequest extends FormRequest
{
    use PasswordValidationRules;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['username' => Str::lower(trim((string) $this->input('username')))]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var User $target */
        $target = $this->route('user');

        return [
            'username' => ['required', 'string', 'min:3', 'max:32', 'regex:/^[a-z0-9._-]+$/', Rule::unique('users', 'username')->ignore($target->id)],
            // The first credentials need a password; later the username can change alone.
            'password' => $target->username === null ? $this->passwordRules() : ['nullable', ...array_slice($this->passwordRules(), 1)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'username.required' => 'Escribe un usuario.',
            'username.min' => 'El usuario necesita al menos 3 caracteres.',
            'username.max' => 'El usuario puede tener hasta 32 caracteres.',
            'username.regex' => 'Usa solo letras minúsculas, números, puntos, guiones o guiones bajos.',
            'username.unique' => 'Ese usuario ya está en uso.',
            'password.required' => 'Escribe una contraseña.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ];
    }

    public function username(): string
    {
        return (string) $this->validated('username');
    }

    public function password(): ?string
    {
        $password = $this->validated('password');

        return is_string($password) && $password !== '' ? $password : null;
    }
}
