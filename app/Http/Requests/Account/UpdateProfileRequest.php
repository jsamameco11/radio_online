<?php

namespace App\Http\Requests\Account;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => mb_strtolower(trim((string) $this->input('email'))),
            'country' => $this->filled('country') ? strtoupper((string) $this->input('country')) : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class)->ignore($this->user()->id)],
            'country' => ['nullable', 'string', 'regex:/^[A-Z]{2}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Escribe tu nombre.',
            'name.min' => 'Tu nombre debe tener al menos 2 caracteres.',
            'name.max' => 'Tu nombre no puede superar los 80 caracteres.',
            'email.required' => 'Escribe tu correo.',
            'email.email' => 'Escribe un correo válido.',
            'email.max' => 'El correo es demasiado largo.',
            'email.unique' => 'Ese correo ya pertenece a otra cuenta.',
            'country.regex' => 'Elige un país de la lista.',
        ];
    }
}
