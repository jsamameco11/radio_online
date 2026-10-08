<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Library\Duplicates;
use App\Models\Track;
use Illuminate\Foundation\Http\FormRequest;

/** The songs of an upload, in order, and which of them to judge against the library and the songs before them. */
class LibraryDuplicatesRequest extends FormRequest
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
            'songs' => ['required', 'array', 'max:'.Duplicates::MAX_SONGS],
            'songs.*.key' => ['required', 'string', 'max:200', 'distinct'],
            'songs.*.title' => ['required', 'string', 'max:200'],
            'songs.*.artist' => ['nullable', 'string', 'max:300'],
            'songs.*.featured' => ['nullable', 'array', 'max:'.Track::MAX_FEATURED],
            'songs.*.featured.*' => ['nullable', 'string', 'max:120'],
            'songs.*.album' => ['nullable', 'string', 'max:200'],
            'songs.*.year' => ['nullable', 'integer', 'between:1900,2100'],
            'songs.*.duration' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'songs.*.ids' => ['nullable', 'array:musicbrainz,deezer,itunes,isrc'],
            'songs.*.ids.*' => ['nullable', 'string', 'max:64'],
            'judge' => ['nullable', 'array', 'max:'.Duplicates::MAX_SONGS],
            'judge.*' => ['string', 'max:200'],
        ];
    }

    /**
     * The songs by their key, ready to be judged.
     *
     * @return array<string, array<string, mixed>>
     */
    public function songs(): array
    {
        return collect($this->validated('songs'))
            ->mapWithKeys(fn (array $song) => [(string) $song['key'] => [
                'title' => trim((string) $song['title']),
                'artist' => trim((string) ($song['artist'] ?? '')),
                'featured' => array_values(array_filter(array_map(fn ($name) => trim((string) $name), $song['featured'] ?? []))),
                'album' => trim((string) ($song['album'] ?? '')),
                'year' => $song['year'] ?? null,
                'duration' => $song['duration'] ?? null,
                'ids' => array_filter($song['ids'] ?? []),
            ]])
            ->all();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'songs.required' => 'No hay canciones para revisar.',
            'songs.max' => 'Revisa como máximo '.Duplicates::MAX_SONGS.' canciones a la vez.',
            'songs.*' => 'Una de las canciones no tiene datos válidos.',
            'songs.*.*' => 'Una de las canciones no tiene datos válidos.',
            'judge.*' => 'La lista de canciones a revisar no es válida.',
        ];
    }
}
