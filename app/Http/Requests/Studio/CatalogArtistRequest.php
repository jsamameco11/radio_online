<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Catalog\ArtistKind;
use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CatalogArtistRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('country'))) {
            $this->merge(['country' => strtoupper(trim((string) $this->input('country'))) ?: null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'kind' => ['nullable', Rule::enum(ArtistKind::class)],
            'country' => ['nullable', 'string', 'regex:/^[A-Z]{2}$/'],
            'genre_ids' => ['required', 'array', 'min:1', 'max:'.Track::MAX_GENRES],
            'genre_ids.*' => ['uuid', 'distinct', Rule::exists('genres', 'id')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del artista.',
            'name.max' => 'El nombre puede tener como máximo 120 caracteres.',
            'kind.*' => 'Elige si es solista o grupo.',
            'country.*' => 'El país debe ser un código de dos letras, como PE o MX.',
            'genre_ids.required' => 'Elige al menos un género.',
            'genre_ids.min' => 'Elige al menos un género.',
            'genre_ids.max' => 'Un artista puede tener hasta '.Track::MAX_GENRES.' géneros.',
            'genre_ids.*' => 'Elige géneros del catálogo.',
        ];
    }
}
