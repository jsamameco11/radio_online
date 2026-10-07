<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\Timeline;
use Illuminate\Foundation\Http\FormRequest;

/** Closes the live recording with the length the console measured. */
class CaptureFinishRequest extends FormRequest
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
        return ['duration' => ['required', 'numeric', 'between:0,'.Timeline::MAX_BLOCK]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['duration.*' => 'La duración de la grabación no es válida.'];
    }
}
