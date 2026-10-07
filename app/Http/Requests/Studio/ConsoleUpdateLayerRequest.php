<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Volume and ducking of a console layer that is sounding. */
class ConsoleUpdateLayerRequest extends FormRequest
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
            'volume' => ['required', 'integer', 'between:0,100'],
            'duck' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['volume' => 'volumen', 'duck' => 'bajar la música'];
    }
}
