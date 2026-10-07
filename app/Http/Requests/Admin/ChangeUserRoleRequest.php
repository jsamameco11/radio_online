<?php

namespace App\Http\Requests\Admin;

use App\Domain\Access\Enums\PlatformRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin > Usuarios > Rol de plataforma. */
class ChangeUserRoleRequest extends FormRequest
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
        return ['role' => ['required', Rule::enum(PlatformRole::class)]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['role.*' => 'Elige un rol de la lista.'];
    }

    public function role(): PlatformRole
    {
        return PlatformRole::from((string) $this->validated('role'));
    }
}
