<?php

namespace App\Http\Requests\Gifts;

use Illuminate\Foundation\Http\FormRequest;

/** Studio › Configuración › Mensajes. */
class MessageSettingsRequest extends FormRequest
{
    public const MAX_BLOCKED_WORDS = 200;

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
            'accept_text' => ['required', 'boolean'],
            'accept_voice' => ['required', 'boolean'],
            'auto_hide_filtered' => ['required', 'boolean'],
            'blocked_words' => ['present', 'array', 'max:'.self::MAX_BLOCKED_WORDS],
            'blocked_words.*' => ['nullable', 'string', 'max:40'],
        ];
    }

    /**
     * @return array{accept_text: bool, accept_voice: bool, auto_hide_filtered: bool, blocked_words: list<string>}
     */
    public function settings(): array
    {
        $words = collect($this->validated('blocked_words'))
            ->map(fn (?string $word) => mb_strtolower(trim((string) $word)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'accept_text' => $this->boolean('accept_text'),
            'accept_voice' => $this->boolean('accept_voice'),
            'auto_hide_filtered' => $this->boolean('auto_hide_filtered'),
            'blocked_words' => $words,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'accept_text.*' => 'Indica si la emisora acepta mensajes de texto.',
            'accept_voice.*' => 'Indica si la emisora acepta mensajes de voz.',
            'auto_hide_filtered.*' => 'Indica qué hacer con los mensajes filtrados.',
            'blocked_words.array' => 'La lista de palabras no es válida.',
            'blocked_words.max' => 'Puedes bloquear hasta '.self::MAX_BLOCKED_WORDS.' palabras.',
            'blocked_words.*.string' => 'Cada palabra bloqueada debe ser un texto.',
            'blocked_words.*.max' => 'Cada palabra bloqueada puede tener como máximo 40 caracteres.',
        ];
    }
}
