<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\Timeline;
use App\Models\ScheduleSlot;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Blocks to put on the timeline: one live block (main layer only) or library audios. Used by
 * «Al aire ahora» in the console; the schedule extends it with where and when.
 */
class BlocksRequest extends FormRequest
{
    public const LIVE = 'live';

    public const TRACKS = 'tracks';

    public const AUTO = 'auto';

    public const MAX_TRACKS = 200;

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
            'type' => ['required', Rule::in($this->types())],
            'title' => ['required_if:type,'.self::LIVE, 'nullable', 'string', 'min:2', 'max:160'],
            'minutes' => ['required_if:type,'.self::LIVE, 'nullable', 'numeric', 'between:1,'.(Timeline::MAX_BLOCK / 60)],
            'bed' => ['sometimes', 'boolean'],
            'tracks' => ['required_if:type,'.self::TRACKS, 'array', 'max:'.self::MAX_TRACKS],
            'tracks.*' => ['uuid'],
            'note' => ['nullable', 'string', 'max:240'],
            'duck' => ['sometimes', 'nullable', 'boolean'],
            'volume' => ['sometimes', 'integer', 'between:0,100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.*' => 'Elige qué quieres programar.',
            'title.required_if' => 'Ponle un nombre al bloque en vivo (por ejemplo «Mañanas al día»).',
            'title.min' => 'Ponle un nombre al bloque en vivo (por ejemplo «Mañanas al día»).',
            'minutes.*' => 'Un bloque en vivo dura entre 1 minuto y 6 horas.',
            'tracks.required_if' => 'Elige al menos un audio de la biblioteca.',
            'tracks.max' => 'Agrega hasta '.self::MAX_TRACKS.' audios a la vez.',
            'tracks.*' => 'Hay un audio que no es válido.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['note' => 'nota', 'volume' => 'volumen'];
    }

    /**
     * The blocks to place on $layer.
     *
     * @return list<array<string, mixed>>
     */
    public function blocks(int $layer): array
    {
        $note = trim((string) $this->validated('note')) ?: null;
        if ($this->validated('type') === self::LIVE) {
            if ($layer !== ScheduleSlot::MAIN) {
                throw ValidationException::withMessages(['layer' => 'Los bloques en vivo van en la pista principal.']);
            }

            return [Schedule::liveBlock(trim((string) $this->validated('title')), (float) $this->validated('minutes'), $this->boolean('bed'), $note)];
        }

        $tracks = Schedule::tracks(array_values((array) $this->validated('tracks', [])));
        if ($tracks->isEmpty()) {
            throw ValidationException::withMessages(['tracks' => 'Esos audios ya no están en la biblioteca.']);
        }
        $duck = $this->filled('duck') ? $this->boolean('duck') : null;

        return Schedule::trackBlocks($tracks, $note, $layer, $duck, (int) $this->validated('volume', 100));
    }

    /** @return list<string> */
    protected function types(): array
    {
        return [self::LIVE, self::TRACKS];
    }
}
