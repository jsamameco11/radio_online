<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\TrackKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordingConvertRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:160'],
            'kind' => ['required', Rule::enum(TrackKind::class)],
            'episode' => ['sometimes', 'boolean'],
            'program' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Escribe el nombre del audio.',
            'title.max' => 'El nombre puede tener como máximo 160 caracteres.',
            'kind.*' => 'Elige qué tipo de audio será.',
            'program.max' => 'El programa puede tener como máximo 120 caracteres.',
            'description.max' => 'La descripción puede tener como máximo 2000 caracteres.',
        ];
    }
}
