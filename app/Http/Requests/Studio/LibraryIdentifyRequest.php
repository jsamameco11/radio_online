<?php

namespace App\Http\Requests\Studio;

use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;

/** What is known of a song (from its file name or tags) to identify it on the internet. */
class LibraryIdentifyRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:200'],
            'artist' => ['nullable', 'string', 'max:200'],
            'featured' => ['nullable', 'array', 'max:'.Track::MAX_FEATURED],
            'featured.*' => ['string', 'max:120'],
            'duration' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'genre' => ['nullable', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Escribe el nombre de la canción para identificarla.',
            'title.max' => 'El nombre de la canción es demasiado largo.',
            'artist.max' => 'El nombre del artista es demasiado largo.',
            'featured.*' => 'Revisa los artistas invitados.',
            'duration.*' => 'La duración no es válida.',
            'genre.*' => 'El género no es válido.',
        ];
    }
}
