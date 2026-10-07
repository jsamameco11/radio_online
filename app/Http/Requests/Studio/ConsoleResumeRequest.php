<?php

namespace App\Http\Requests\Studio;

use App\Http\Requests\Concerns\ChoosesPlaylist;
use Illuminate\Foundation\Http\FormRequest;

/** «Volver a la música», optionally with another playlist or order. */
class ConsoleResumeRequest extends FormRequest
{
    use ChoosesPlaylist;

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
            'change' => ['sometimes', 'boolean'],
            'playlist' => ['nullable', 'uuid'],
            'shuffle' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['playlist.*' => 'Esa lista de reproducción ya no existe.'];
    }
}
