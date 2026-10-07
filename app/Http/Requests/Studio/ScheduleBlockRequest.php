<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Actions\PlaceBlocks;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Http\Requests\Concerns\ChoosesPlaylist;
use App\Models\ScheduleSlot;
use Illuminate\Validation\Rule;

/** Blocks to place on a day of the timeline: where (layer), when (a time, after the last block, now) and what. */
class ScheduleBlockRequest extends BlocksRequest
{
    use ChoosesPlaylist;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'date' => ['required', 'date_format:Y-m-d'],
            'mode' => ['required', Rule::in([PlaceBlocks::AT, PlaceBlocks::END, PlaceBlocks::NOW])],
            'layer' => ['required', 'integer', 'between:'.ScheduleSlot::MAIN.','.ScheduleSlot::OVERLAYS],
            'time' => ['required_if:mode,'.PlaceBlocks::AT, 'nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'until' => ['required_if:type,'.self::AUTO, 'nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'playlist' => ['nullable', 'uuid'],
            'shuffle' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'date.*' => 'Elige un día válido.',
            'mode.*' => 'Elige cuándo debe sonar.',
            'layer.*' => 'Elige una pista válida.',
            'time.*' => 'Escribe la hora de inicio (por ejemplo 18:30 o 18:30:15).',
            'until.*' => 'Escribe la hora en que termina la música automática (por ejemplo 18:00).',
            'playlist.*' => 'Esa lista de reproducción ya no existe.',
        ];
    }

    public function day(): string
    {
        return BroadcastClock::date($this->validated('date')) ?? BroadcastClock::today();
    }

    public function layer(): int
    {
        return (int) $this->validated('layer');
    }

    /** @return list<string> */
    protected function types(): array
    {
        return [self::LIVE, self::TRACKS, self::AUTO];
    }
}
