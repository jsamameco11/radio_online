<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Opens the recording of the live session on air. */
class CaptureStartRequest extends FormRequest
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
        return ['session' => ['required', 'string', 'max:40']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['session.*' => 'Abre la transmisión en vivo para empezar a grabar.'];
    }
}
