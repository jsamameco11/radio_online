<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\AudioFile;
use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Adds an audio to the library (with its file, and optionally published as an
 * episode) or changes its details (and, optionally, its file). With
 * "replace_audio" a new file takes the place of the one of a song already in
 * the library, which keeps its details.
 */
class LibraryTrackRequest extends FormRequest
{
    public const MAX_EPISODE_DESCRIPTION = 2000;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('identity'))) {
            $this->merge(['identity' => json_decode((string) $this->input('identity'), true)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = $this->isMethod('post') && ! $this->route('track');
        $replacing = ! $creating && $this->boolean('replace_audio');
        $newAudio = $creating || $replacing || $this->hasFile('audio') || $this->filled('upload');
        $song = $this->input('kind') === TrackKind::Song->value && ! $replacing;

        return [
            'kind' => [$creating ? 'required' : 'sometimes', Rule::enum(TrackKind::class)],
            'title' => ['required', 'string', 'max:160'],
            'artist' => [$song ? 'required' : 'nullable', 'string', 'max:120'],
            'featured' => ['nullable', 'array', 'max:'.Track::MAX_FEATURED],
            'featured.*' => ['string', 'max:120', 'distinct:ignore_case'],
            'album' => ['nullable', 'string', 'max:160'],
            'year' => ['nullable', 'integer', 'between:1900,'.(now()->year + 1)],
            'genre_ids' => ['nullable', 'array', 'max:'.Track::MAX_GENRES],
            'genre_ids.*' => ['uuid', 'distinct', Rule::exists('genres', 'id')],
            'rotation' => ['sometimes', 'boolean'],
            'duck' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'replace_audio' => [$creating ? 'prohibited' : 'sometimes', 'boolean'],
            'episode' => [$creating ? 'sometimes' : 'prohibited', 'boolean'],
            'episode_description' => ['nullable', 'string', 'max:'.self::MAX_EPISODE_DESCRIPTION],
            'episode_cover' => ['nullable', 'image', 'mimes:'.implode(',', AudioFile::COVER_TYPES), 'max:'.config('platform.media.max_cover_mb') * 1024],
            'cover' => ['nullable', 'image', 'mimes:'.implode(',', AudioFile::COVER_TYPES), 'max:'.config('platform.media.max_cover_mb') * 1024],
            'cover_url' => ['nullable', 'url:https', 'max:500'],
            'remove_cover' => ['sometimes', 'boolean'],
            'identity' => ['nullable', 'array'],
            'identity.confidence' => ['nullable', Rule::in(['high', 'medium', 'low'])],
            'identity.score' => ['nullable', 'numeric', 'between:0,1'],
            'identity.sources' => ['nullable', 'array', 'max:5'],
            'identity.sources.*' => ['string', 'max:20'],
            'identity.ids' => ['nullable', 'array:musicbrainz,deezer,itunes,isrc'],
            'identity.ids.*' => ['nullable', 'string', 'max:64'],
            'identity.artist' => ['nullable', 'array:kind,country,musicbrainz_id'],
            'identity.artist.*' => ['nullable', 'string', 'max:64'],
            'identity.guessed' => ['nullable', 'array', 'max:2'],
            'identity.guessed.*' => [Rule::in(['genres', 'year'])],
            'duration' => [$newAudio ? 'required' : 'nullable', 'numeric', 'min:0.5', 'max:'.AudioFile::maxDuration()],
            'upload' => ['nullable', 'string', 'size:40'],
            'parts' => ['nullable', 'string', 'max:200000'],
            'audio' => [$creating || $replacing ? 'required_without:upload' : 'nullable', 'file'],
            'duplicate_ok' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kind.*' => 'Elige qué tipo de audio es.',
            'title.required' => 'Escribe el nombre del audio.',
            'title.max' => 'El nombre puede tener como máximo 160 caracteres.',
            'artist.required' => 'Escribe el autor de la canción.',
            'artist.max' => 'El artista puede tener como máximo 120 caracteres.',
            'album.max' => 'El álbum puede tener como máximo 160 caracteres.',
            'featured.*.max' => 'Cada artista invitado puede tener como máximo 120 caracteres.',
            'featured.max' => 'Una canción puede acreditar hasta '.Track::MAX_FEATURED.' artistas invitados.',
            'featured.*.distinct' => 'Hay un artista invitado repetido.',
            'year.*' => 'El año debe estar entre 1900 y '.(now()->year + 1).'.',
            'genre_ids.max' => 'Una canción puede tener hasta '.Track::MAX_GENRES.' géneros.',
            'genre_ids.*' => 'Elige géneros del catálogo.',
            'cover.image' => 'La portada debe ser una imagen.',
            'cover.mimes' => 'La portada debe ser JPG, PNG o WEBP.',
            'cover.max' => 'La portada puede pesar como máximo '.config('platform.media.max_cover_mb').' MB.',
            'cover_url.*' => 'La dirección de la portada no es válida.',
            'identity.*' => 'La identificación de la canción no es válida. Vuelve a identificarla.',
            'duration.required' => 'No pudimos leer la duración del audio. Revisa que el archivo no esté dañado.',
            'duration.min' => 'El audio es demasiado corto.',
            'duration.max' => 'El audio puede durar como máximo '.intdiv(AudioFile::maxDuration(), 3600).' horas.',
            'audio.required_without' => 'Elige el archivo de audio.',
            'audio.file' => 'El archivo de audio no llegó completo. Inténtalo de nuevo.',
            'upload.*' => 'La subida del audio no es válida. Vuelve a subirlo.',
            'replace_audio.*' => 'Elige la canción de la biblioteca cuyo audio quieres reemplazar.',
            'episode.*' => 'Solo un audio nuevo se puede publicar también como episodio.',
            'episode_description.max' => 'La descripción del episodio puede tener como máximo '.self::MAX_EPISODE_DESCRIPTION.' caracteres.',
            'episode_cover.image' => 'La portada del episodio debe ser una imagen.',
            'episode_cover.mimes' => 'La portada del episodio debe ser JPG, PNG o WEBP.',
            'episode_cover.max' => 'La portada del episodio puede pesar como máximo '.config('platform.media.max_cover_mb').' MB.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'kind' => 'tipo',
            'title' => 'nombre',
            'artist' => 'artista',
            'featured' => 'artistas invitados',
            'album' => 'álbum',
            'year' => 'año',
            'genre_ids' => 'géneros',
            'cover' => 'portada',
            'duration' => 'duración',
            'audio' => 'archivo de audio',
        ];
    }
}
