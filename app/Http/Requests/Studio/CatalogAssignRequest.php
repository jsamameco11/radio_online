<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Catalog\Actions\AssignGenres;
use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CatalogAssignRequest extends FormRequest
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
            'track_ids' => ['required', 'array', 'min:1', 'max:500'],
            'track_ids.*' => ['uuid', 'distinct'],
            'genre_ids' => ['required', 'array', 'min:1', 'max:'.Track::MAX_GENRES],
            'genre_ids.*' => ['uuid', 'distinct', Rule::exists('genres', 'id')],
            'mode' => ['required', Rule::in([AssignGenres::ADD, AssignGenres::REPLACE])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'track_ids.required' => 'Elige al menos una canción.',
            'track_ids.min' => 'Elige al menos una canción.',
            'track_ids.max' => 'Asigna géneros a como máximo 500 canciones a la vez.',
            'track_ids.*' => 'Hay una canción que no es válida.',
            'genre_ids.required' => 'Elige al menos un género.',
            'genre_ids.min' => 'Elige al menos un género.',
            'genre_ids.max' => 'Una canción puede tener hasta '.Track::MAX_GENRES.' géneros.',
            'genre_ids.*' => 'Elige géneros del catálogo.',
            'mode.*' => 'Elige si los géneros se agregan o reemplazan a los actuales.',
        ];
    }
}
