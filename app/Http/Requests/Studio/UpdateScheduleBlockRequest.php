<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\Timeline;
use App\Http\Requests\Concerns\ChoosesPlaylist;
use App\Models\ScheduleSlot;
use Illuminate\Foundation\Http\FormRequest;

/** Edits a block of the timeline. */
class UpdateScheduleBlockRequest extends FormRequest
{
    use ChoosesPlaylist;

    private const TIME = 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/';

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
            'date' => ['nullable', 'date_format:Y-m-d'],
            'time' => ['nullable', self::TIME],
            'title' => ['nullable', 'string', 'max:160'],
            'note' => ['nullable', 'string', 'max:240'],
            'minutes' => ['nullable', 'numeric', 'between:1,'.(Timeline::MAX_BLOCK / 60)],
            'bed' => ['sometimes', 'boolean'],
            'playlist' => ['sometimes', 'nullable', 'uuid'],
            'shuffle' => ['sometimes', 'boolean'],
            'until' => ['nullable', self::TIME],
            'layer' => ['sometimes', 'integer', 'between:'.ScheduleSlot::MAIN.','.ScheduleSlot::OVERLAYS],
            'duck' => ['sometimes', 'boolean'],
            'volume' => ['sometimes', 'integer', 'between:0,100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.*' => 'Elige un día válido.',
            'time.*' => 'Escribe una hora válida (por ejemplo 18:30 o 18:30:15).',
            'until.*' => 'Escribe la hora en que termina (por ejemplo 18:00).',
            'minutes.*' => 'Un bloque en vivo dura entre 1 minuto y 6 horas.',
            'playlist.*' => 'Esa lista de reproducción ya no existe.',
            'layer.*' => 'Elige una pista válida.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['title' => 'nombre', 'note' => 'nota', 'volume' => 'volumen'];
    }

    /** @return array<string, mixed> the changes for UpdateBlock */
    public function changes(): array
    {
        $data = $this->safe()->except(['playlist']);
        foreach (['bed', 'shuffle', 'duck'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = $this->boolean($key);
            }
        }
        $data['title'] = trim((string) ($data['title'] ?? '')) ?: null;
        $data['note'] = trim((string) ($data['note'] ?? '')) ?: null;
        if ($this->has('playlist')) {
            $data['playlist'] = $this->playlist();
        }

        return $data;
    }
}
