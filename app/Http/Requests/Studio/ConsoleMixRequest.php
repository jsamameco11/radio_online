<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Faders and switches of the console mixer; only the keys sent change. */
class ConsoleMixRequest extends FormRequest
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
            'music' => ['sometimes', 'integer', 'between:0,100'],
            'overlay' => ['sometimes', 'integer', 'between:0,100'],
            'pads' => ['sometimes', 'integer', 'between:0,100'],
            'muted' => ['sometimes', 'boolean'],
            'bed' => ['sometimes', 'boolean'],
            'mic' => ['sometimes', 'boolean'],
            'host' => ['sometimes', 'string', 'max:80'],
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'music' => 'volumen de la música',
            'overlay' => 'volumen de las capas',
            'pads' => 'volumen de la botonera',
            'muted' => 'silencio',
            'bed' => 'música de fondo',
            'mic' => 'micrófono',
            'host' => 'nombre del locutor',
            'title' => 'nombre del programa',
        ];
    }

    /** @return array<string, mixed> the changes for the live state */
    public function changes(): array
    {
        $data = $this->validated();
        foreach (['muted', 'bed', 'mic'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = $this->boolean($key);
            }
        }
        if (array_key_exists('host', $data) && trim($data['host']) === '') {
            unset($data['host']);
        }
        if (array_key_exists('title', $data)) {
            $data['title'] = trim((string) preg_replace('/\s+/u', ' ', (string) $data['title']));
        }

        return $data;
    }
}
