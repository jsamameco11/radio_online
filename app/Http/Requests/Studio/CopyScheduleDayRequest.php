<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\BroadcastClock;
use Illuminate\Foundation\Http\FormRequest;

/** Copies the blocks of a day to other days. */
class CopyScheduleDayRequest extends FormRequest
{
    public const MAX_DAYS = 31;

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
            'date' => ['required', 'date_format:Y-m-d'],
            'targets' => ['required', 'array', 'min:1', 'max:'.self::MAX_DAYS],
            'targets.*' => ['date_format:Y-m-d', 'different:date', 'after_or_equal:'.BroadcastClock::today()],
            'replace' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.*' => 'Elige el día que quieres copiar.',
            'targets.required' => 'Elige uno o más días futuros para copiar la programación.',
            'targets.min' => 'Elige uno o más días futuros para copiar la programación.',
            'targets.max' => 'Copia hasta '.self::MAX_DAYS.' días a la vez.',
            'targets.*' => 'Elige días futuros distintos del que copias.',
        ];
    }

    /** @return list<string> */
    public function targets(): array
    {
        return array_values(array_unique((array) $this->validated('targets')));
    }
}
