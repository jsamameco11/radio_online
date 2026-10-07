<?php

namespace App\Http\Requests\Studio;

use App\Http\Requests\Concerns\ChoosesPlaylist;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The source of the automatic music: a playlist (or random songs), shuffled or in order; to start
 * now from a song, or to switch when the song on air ends («song»), at a chosen boundary («at»)
 * or at once («now»).
 */
class MusicSourceRequest extends FormRequest
{
    use ChoosesPlaylist;

    public const SONG = 'song';

    public const AT = 'at';

    public const NOW = 'now';

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
            'playlist' => ['nullable', 'uuid'],
            'shuffle' => ['sometimes', 'boolean'],
            'first' => ['nullable', 'uuid'],
            'repeat' => ['sometimes', 'nullable', 'boolean'],
            'when' => ['sometimes', Rule::in([self::SONG, self::AT, self::NOW])],
            'at' => ['required_if:when,'.self::AT, 'nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'playlist.*' => 'Esa lista de reproducción ya no existe.',
            'first.*' => 'Esa canción no está disponible. Elige otra.',
            'when.*' => 'Elige cuándo se hace el cambio.',
            'at.*' => 'Elige dónde hacer el cambio.',
        ];
    }

    public function shuffle(): bool
    {
        return $this->boolean('shuffle', true);
    }

    public function repeat(): ?bool
    {
        return $this->filled('repeat') ? $this->boolean('repeat') : null;
    }

    public function immediately(): bool
    {
        return $this->validated('when') === self::NOW;
    }

    public function at(): ?int
    {
        return $this->validated('when') === self::AT ? (int) $this->validated('at') : null;
    }
}
