<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use Illuminate\Foundation\Http\FormRequest;

/** Settings › Audio: crossfade between songs and the mix levels of the console. */
class AudioSettingsRequest extends FormRequest
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
            'crossfade' => ['required', 'numeric', 'between:0,'.LiveDesk::MAX_FADE],
            'bed_level' => ['required', 'integer', 'between:0,100'],
            'fx_level' => ['required', 'integer', 'between:0,100'],
            'duck_level' => ['required', 'integer', 'between:0,100'],
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
