<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\TrackKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Opens the direct upload of an audio file to storage. */
class LibraryUploadRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1'],
            'kind' => ['required', Rule::enum(TrackKind::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.*' => 'El archivo no tiene un nombre válido.',
            'size.*' => 'El archivo está vacío.',
            'kind.*' => 'Elige qué tipo de audio es.',
        ];
    }
}
