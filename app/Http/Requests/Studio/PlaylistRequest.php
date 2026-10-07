<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Library\Actions\SavePlaylist;
use Illuminate\Foundation\Http\FormRequest;

class PlaylistRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:240'],
            'track_ids' => ['nullable', 'array', 'max:'.SavePlaylist::MAX_TRACKS],
            'track_ids.*' => ['uuid', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre de la lista.',
            'name.max' => 'El nombre puede tener como máximo 80 caracteres.',
            'description.max' => 'La descripción puede tener como máximo 240 caracteres.',
            'track_ids.max' => 'Una lista puede tener como máximo '.SavePlaylist::MAX_TRACKS.' canciones.',
            'track_ids.*' => 'Hay una canción repetida o que no es válida.',
        ];
    }
}
