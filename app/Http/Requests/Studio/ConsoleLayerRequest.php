<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Puts a library audio on air on top of the program: a pad, a player (A–C) or a bed (F1, F2). */
class ConsoleLayerRequest extends FormRequest
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
            'track' => ['required', 'uuid'],
            'lane' => ['required', Rule::in(LiveDesk::LANES)],
            'volume' => ['sometimes', 'integer', 'between:0,100'],
            'duck' => ['sometimes', 'nullable', 'boolean'],
            'fade_in' => ['sometimes', 'numeric', 'between:0,'.LiveDesk::MAX_FADE],
            'fade_out' => ['sometimes', 'numeric', 'between:0,'.LiveDesk::MAX_FADE],
            'loop' => ['sometimes', 'boolean'],
            'layer' => ['sometimes', 'nullable', 'string', 'regex:/^[a-z0-9]{12}$/'],
            'at' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'track.*' => 'Elige un audio de la biblioteca.',
            'lane.*' => 'Ese reproductor no existe.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['volume' => 'volumen', 'fade_in' => 'entrada gradual', 'fade_out' => 'salida gradual'];
    }
}
