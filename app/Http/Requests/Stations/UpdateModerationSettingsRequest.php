<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Support\StationPreferences;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Estudio > Configuración > Moderación. */
class UpdateModerationSettingsRequest extends FormRequest
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
            'blocked_words' => ['array', 'max:200'],
            'blocked_words.*' => ['string', 'max:40'],
            'slow_mode_seconds' => ['required', 'integer', Rule::in(StationPreferences::SLOW_MODE_OPTIONS)],
            'block_links' => ['required', 'boolean'],
            'auto_hide_reported' => ['required', 'boolean'],
            'auto_hide_threshold' => ['required', 'integer', 'between:1,20'],
            'notify_team_on_report' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'blocked_words.max' => 'Puedes bloquear hasta 200 palabras.',
            'blocked_words.*.*' => 'Cada palabra bloqueada puede tener como máximo 40 caracteres.',
            'slow_mode_seconds.*' => 'Elige un intervalo de la lista.',
            'auto_hide_threshold.*' => 'Indica entre 1 y 20 reportes.',
            '*.boolean' => 'Indica sí o no.',
            '*.required' => 'Completa esta opción.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function settings(): array
    {
        $words = collect((array) $this->validated('blocked_words', []))
            ->map(fn (mixed $word) => mb_strtolower(trim((string) $word)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'blocked_words' => $words,
            'slow_mode_seconds' => (int) $this->validated('slow_mode_seconds'),
            'block_links' => $this->boolean('block_links'),
            'auto_hide_reported' => $this->boolean('auto_hide_reported'),
            'auto_hide_threshold' => (int) $this->validated('auto_hide_threshold'),
            'notify_team_on_report' => $this->boolean('notify_team_on_report'),
        ];
    }
}
