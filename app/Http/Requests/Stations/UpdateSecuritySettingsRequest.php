<?php

namespace App\Http\Requests\Stations;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Configuración > Seguridad: require two-factor authentication from the whole team. */
class UpdateSecuritySettingsRequest extends FormRequest
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
            'require_two_factor' => ['required', 'boolean', function (string $attribute, mixed $value, Closure $fail) {
                if ($this->boolean('require_two_factor') && ! $this->user()->hasTwoFactorEnabled()) {
                    $fail('Activa primero tu propia verificación en dos pasos.');
                }
            }],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['require_two_factor.required' => 'Indica sí o no.', 'require_two_factor.boolean' => 'Indica sí o no.'];
    }
}
