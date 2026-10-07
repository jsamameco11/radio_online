<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Capture\LiveCapture;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** The next piece of the live recording. */
class CaptureChunkRequest extends FormRequest
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
            'index' => ['required', 'integer', 'between:0,20000'],
            'extension' => ['required', Rule::in(['webm', 'm4a'])],
            'audio' => ['required', 'file', 'max:'.(LiveCapture::CHUNK_MB * 1024)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'index.*' => 'Ese tramo de la grabación no corresponde.',
            'extension.*' => 'La grabación tiene que ser audio WebM o M4A.',
            'audio.max' => 'Un tramo de la grabación es demasiado grande.',
            'audio.*' => 'No llegó el audio de este tramo.',
        ];
    }
}
