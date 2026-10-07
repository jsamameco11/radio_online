<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\LiveMode;
use App\Domain\Studio\Enums\LiveSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Settings › Transmisión: on the air, song titles, the live switch and the live microphone audience. */
class BroadcastSettingsRequest extends FormRequest
{
    public const BITRATES = [32, 48, 64, 96, 128];

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
            'on_air' => ['required', 'boolean'],
            'show_titles' => ['required', 'boolean'],
            'live_mode' => ['required', Rule::enum(LiveMode::class)],
            'live_source' => ['required', Rule::enum(LiveSource::class)],
            'live_url' => ['nullable', 'required_if:live_source,'.LiveSource::External->value, 'url:http,https', 'max:500'],
            'max_voice' => ['required', 'integer', 'between:1,500'],
            'stream_url' => ['nullable', 'url:http,https', 'max:500'],
            'bitrate_kbps' => ['required', 'integer', Rule::in(self::BITRATES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'live_url.required_if' => 'Escribe el enlace de la señal externa (OBS, Icecast) para usarla en vivo.',
            'bitrate_kbps.in' => 'Elige una calidad de la lista.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'on_air' => 'al aire',
            'show_titles' => 'mostrar títulos',
            'live_mode' => 'modo del vivo',
            'live_source' => 'fuente del vivo',
            'live_url' => 'enlace de la señal externa',
            'max_voice' => 'oyentes del micrófono en vivo',
            'stream_url' => 'enlace de transmisión externa',
            'bitrate_kbps' => 'calidad de audio',
        ];
    }

    /** @return array<string, mixed> the keys of the broadcast group */
    public function settings(): array
    {
        return [
            'on_air' => $this->boolean('on_air'),
            'show_titles' => $this->boolean('show_titles'),
            'live_mode' => $this->validated('live_mode'),
            'live_source' => $this->validated('live_source'),
            'live_url' => trim((string) $this->validated('live_url')),
            'max_voice' => (int) $this->validated('max_voice'),
        ];
    }
}
