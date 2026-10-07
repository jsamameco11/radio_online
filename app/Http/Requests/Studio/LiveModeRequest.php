<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\LiveMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Automatic or manual live switch. */
class LiveModeRequest extends FormRequest
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
        return ['mode' => ['required', Rule::enum(LiveMode::class)]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['mode.*' => 'Elige el modo del vivo: automático o manual.'];
    }

    public function mode(): LiveMode
    {
        return LiveMode::from($this->validated('mode'));
    }
}
