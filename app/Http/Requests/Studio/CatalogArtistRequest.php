<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Catalog\ArtistKind;
use App\Http\Requests\Studio\Concerns\SplitsCatalogNames;
use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CatalogArtistRequest extends FormRequest
{
    use SplitsCatalogNames;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) preg_replace('/\s+/u', ' ', (string) $this->input('name'))),
            'aliases' => $this->names($this->input('aliases')),
            'kind' => $this->input('kind') ?: null,
            'country' => is_string($this->input('country')) ? (strtoupper(trim($this->input('country'))) ?: null) : $this->input('country'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'aliases' => ['array', 'max:'.self::MAX_NAMES],
            'aliases.*' => ['string', 'max:120'],
            'kind' => ['nullable', Rule::enum(ArtistKind::class)],
            'country' => ['nullable', 'string', 'regex:/^[A-Z]{2}$/'],
            'genre_ids' => ['nullable', 'array', 'max:'.Track::MAX_GENRES],
            'genre_ids.*' => ['uuid', 'distinct', Rule::exists('genres', 'id')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del artista o de la agrupación.',
            'name.max' => 'El nombre puede tener como máximo 120 caracteres.',
            'aliases.max' => 'Son demasiados nombres alternativos: deja hasta '.self::MAX_NAMES.'.',
            'aliases.*' => 'Cada nombre alternativo puede tener como máximo 120 caracteres.',
            'kind.*' => 'Elige si es solista o agrupación.',
            'country.*' => 'El país debe ser un código de dos letras, como PE o MX.',
            'genre_ids.max' => 'Un artista puede tener hasta '.Track::MAX_GENRES.' géneros.',
            'genre_ids.*' => 'Elige géneros del catálogo.',
        ];
    }
}
