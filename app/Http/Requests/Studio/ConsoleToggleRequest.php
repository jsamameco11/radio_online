<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** A console switch: on the air, the automatic music, «Repetir». */
class ConsoleToggleRequest extends FormRequest
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
        return ['on' => ['required', 'boolean']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['on.*' => 'Indica si se enciende o se apaga.'];
    }

    public function on(): bool
    {
        return $this->boolean('on');
    }
}
