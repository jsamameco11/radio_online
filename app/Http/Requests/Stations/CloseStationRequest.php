<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Support\CurrentStation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Danger zone: only the owner closes the station, typing its frequency and password. */
class CloseStationRequest extends FormRequest
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
            'confirmation' => ['required', 'string', Rule::in([app(CurrentStation::class)->get()->frequency->label])],
            'password' => ['required', 'current_password'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $label = app(CurrentStation::class)->get()->frequency->label;

        return [
            'confirmation.*' => "Escribe {$label} para confirmar.",
            'password.required' => 'Confirma con tu contraseña.',
            'password.current_password' => 'La contraseña no es correcta.',
        ];
    }
}
