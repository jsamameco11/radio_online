<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Enums\StationRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Estudio > Configuración > Equipo: change the role of a member. */
class ChangeStationMemberRoleRequest extends FormRequest
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
        return ['role' => ['required', Rule::enum(StationRole::class)->except([StationRole::Owner])]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['role.*' => 'Elige un rol: administrador de radio, locutor o editor de contenido.'];
    }

    public function role(): StationRole
    {
        return StationRole::from((string) $this->validated('role'));
    }
}
