<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use Illuminate\Foundation\Http\FormRequest;

/** Settings › Audio: crossfade between songs and the mix levels of the console. */
class AudioSettingsRequest extends FormRequest
{
    /**
     * Allowed range of each level, in percent: below the minimum a bed or a ducked song is
     * inaudible, above the maximum it covers the voice.
     */
    public const RANGES = [
        'bed_level' => [5, 60],
        'duck_level' => [5, 80],
        'fx_level' => [10, 100],
    ];

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
            'crossfade' => ['required', 'numeric', 'between:0,'.LiveDesk::MAX_FADE],
            ...array_map(fn (array $range) => ['required', 'integer', "between:{$range[0]},{$range[1]}"], self::RANGES),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'crossfade.between' => 'El fundido entre canciones va de 0 a '.LiveDesk::MAX_FADE.' segundos.',
            ...collect(self::RANGES)->mapWithKeys(fn (array $range, string $key) => ["{$key}.between" => "Elige un valor entre {$range[0]} % y {$range[1]} %."])->all(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'crossfade' => 'fundido entre canciones',
            'bed_level' => 'volumen de la música de fondo',
            'fx_level' => 'volumen de efectos y capas',
            'duck_level' => 'volumen de la música bajo las voces',
        ];
    }

    /** @return array<string, mixed> */
    public function settings(): array
    {
        return [
            'crossfade' => round((float) $this->validated('crossfade'), 1),
            'bed_level' => (int) $this->validated('bed_level'),
            'fx_level' => (int) $this->validated('fx_level'),
            'duck_level' => (int) $this->validated('duck_level'),
        ];
    }
}
