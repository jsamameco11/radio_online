<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Support\CurrentStation;
use Illuminate\Foundation\Http\FormRequest;

/** Danger zone: only the owner hands the station over, confirming with their password. */
class TransferOwnershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->id === app(CurrentStation::class)->get()->owner_id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer'],
            'password' => ['required', 'current_password'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.*' => 'Elige a quién le transfieres la emisora.',
            'password.required' => 'Confirma con tu contraseña.',
            'password.current_password' => 'La contraseña no es correcta.',
        ];
    }
}
