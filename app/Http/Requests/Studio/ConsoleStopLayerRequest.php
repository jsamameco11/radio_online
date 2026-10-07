<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Stops console layers (one, a lane or all), at once or fading out. */
class ConsoleStopLayerRequest extends FormRequest
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
            'lane' => ['sometimes', 'nullable', Rule::in(LiveDesk::LANES)],
            'layer' => ['sometimes', 'nullable', 'string', 'max:40'],
            'fade' => ['sometimes', 'numeric', 'between:0,'.LiveDesk::MAX_FADE],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['lane.*' => 'Ese reproductor no existe.'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['fade' => 'salida gradual'];
    }
}
