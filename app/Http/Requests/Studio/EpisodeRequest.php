<?php

namespace App\Http\Requests\Studio;

use App\Domain\Discovery\Hashtags;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Episodes\Actions\SaveEpisode;
use App\Domain\Studio\Library\AudioFile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EpisodeRequest extends FormRequest
{
    public const MAX_DESCRIPTION = 2000;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = ! $this->route('episode');
        $source = $this->input('source');
        $maxTags = (int) config('platform.media.max_episode_hashtags');

        return [
            'title' => ['required', 'string', 'max:160'],
            'program' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:'.self::MAX_DESCRIPTION],
            'season' => ['nullable', 'integer', 'between:1,999'],
            'number' => ['nullable', 'integer', 'between:1,9999'],
            'aired_on' => ['nullable', 'date'],
            'hashtags' => ['nullable', 'array', 'max:'.$maxTags],
            'hashtags.*' => ['string', 'max:'.Hashtags::MAX_LENGTH],
            'status' => ['required', Rule::enum(EpisodeStatus::class)],
            'publish_at' => ['nullable', 'required_if:status,'.EpisodeStatus::Scheduled->value, 'date', 'after:now'],
            'cover' => ['nullable', 'image', 'mimes:'.implode(',', AudioFile::COVER_TYPES), 'max:'.config('platform.media.max_cover_mb') * 1024],
            'remove_cover' => ['sometimes', 'boolean'],
            'source' => [$creating ? 'required' : 'nullable', Rule::in([SaveEpisode::UPLOAD, SaveEpisode::LIBRARY, SaveEpisode::RECORDING])],
            'audio' => ['nullable', 'file'],
            'upload' => ['nullable', 'string', 'size:40'],
            'parts' => ['nullable', 'string', 'max:200000'],
            'duration' => [$source === SaveEpisode::UPLOAD ? 'required' : 'nullable', 'numeric', 'min:0.5', 'max:'.AudioFile::maxDuration()],
            'track_id' => [$source === SaveEpisode::LIBRARY ? 'required' : 'nullable', 'uuid'],
            'recording_id' => [$source === SaveEpisode::RECORDING ? 'required' : 'nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $maxTags = (int) config('platform.media.max_episode_hashtags');

        return [
            'title.required' => 'Escribe el título del episodio.',
            'title.max' => 'El título puede tener como máximo 160 caracteres.',
            'program.max' => 'El programa puede tener como máximo 120 caracteres.',
            'description.max' => 'La descripción puede tener como máximo '.self::MAX_DESCRIPTION.' caracteres.',
            'season.*' => 'La temporada debe ser un número entre 1 y 999.',
            'number.*' => 'El número de episodio debe estar entre 1 y 9999.',
            'aired_on.*' => 'La fecha de emisión no es válida.',
            'hashtags.max' => "Usa como máximo {$maxTags} hashtags.",
            'hashtags.*' => 'Cada hashtag puede tener como máximo '.Hashtags::MAX_LENGTH.' caracteres.',
            'status.*' => 'Elige el estado del episodio.',
            'publish_at.required_if' => 'Elige cuándo se publicará el episodio.',
            'publish_at.date' => 'La fecha de publicación no es válida.',
            'publish_at.after' => 'La fecha de publicación debe ser futura.',
            'cover.image' => 'La portada debe ser una imagen.',
            'cover.mimes' => 'La portada debe ser JPG, PNG o WEBP.',
            'cover.max' => 'La portada puede pesar como máximo '.config('platform.media.max_cover_mb').' MB.',
            'source.*' => 'Elige el audio del episodio.',
            'audio.file' => 'El archivo de audio no llegó completo. Inténtalo de nuevo.',
            'upload.*' => 'La subida del audio no es válida. Vuelve a subirlo.',
            'duration.required' => 'No pudimos leer la duración del audio. Revisa que el archivo no esté dañado.',
            'duration.*' => 'La duración del audio no es válida.',
            'track_id.*' => 'Elige un audio de la biblioteca.',
            'recording_id.*' => 'Elige una grabación.',
        ];
    }
}
