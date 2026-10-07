<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** A stretch of the program to resolve song by song: «desde» and «hasta» in UTC ms, at most SPAN apart. */
class ProgramRangeRequest extends FormRequest
{
    public const SPAN = 36 * 3600000;

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
            'desde' => ['required', 'integer', 'min:1'],
            'hasta' => ['required', 'integer', 'gt:desde', 'lte:'.((int) $this->query('desde') + self::SPAN)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['desde.*' => 'Elige un tramo de hasta 36 horas.', 'hasta.*' => 'Elige un tramo de hasta 36 horas.'];
    }

    /** @return array{0: int, 1: int} */
    public function range(): array
    {
        return [(int) $this->validated('desde'), (int) $this->validated('hasta')];
    }
}
