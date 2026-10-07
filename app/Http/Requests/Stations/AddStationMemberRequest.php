<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Enums\StationRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Estudio > Configuración > Equipo: add someone with an existing account. */
class AddStationMemberRequest extends FormRequest
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
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::enum(StationRole::class)->except([StationRole::Owner])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.*' => 'Escribe el correo de la cuenta que quieres sumar.',
            'role.*' => 'Elige un rol: administrador de radio, locutor o editor de contenido.',
        ];
    }

    public function role(): StationRole
    {
        return StationRole::from((string) $this->validated('role'));
    }
}
