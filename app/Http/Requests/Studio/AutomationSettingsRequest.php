<?php

namespace App\Http\Requests\Studio;

use App\Http\Requests\Concerns\ChoosesPlaylist;
use Illuminate\Foundation\Http\FormRequest;

/** Settings › Automatización: the automatic music of the gaps (on, source, order, repeat). */
class AutomationSettingsRequest extends FormRequest
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
            'autofill' => ['required', 'boolean'],
            'playlist' => ['nullable', 'uuid'],
            'shuffle' => ['required', 'boolean'],
            'repeat' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['playlist.*' => 'Esa lista de reproducción ya no existe.'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['autofill' => 'música automática', 'shuffle' => 'orden aleatorio', 'repeat' => 'repetir'];
    }
}
