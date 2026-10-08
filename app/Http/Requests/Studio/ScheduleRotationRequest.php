<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Programación › Música continua: the songs of the library that repeat in the automatic music. */
class ScheduleRotationRequest extends FormRequest
{
    public const MAX_TRACKS = 5000;

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
            'tracks' => ['present', 'array', 'max:'.self::MAX_TRACKS],
            'tracks.*' => ['string', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tracks.present' => 'Elige las canciones de la música continua.',
            'tracks.array' => 'Elige las canciones de la música continua.',
            'tracks.max' => 'Elige hasta '.self::MAX_TRACKS.' canciones.',
            'tracks.*' => 'Una de las canciones elegidas no es válida. Recarga la página.',
        ];
    }

    /** @return list<string> */
    public function tracks(): array
    {
        return array_values(array_unique((array) $this->validated('tracks')));
    }
}
