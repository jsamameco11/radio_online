<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

/** A signed-in listener scoring the station on the page, from 1 to 5 stars. */
class RateStationRequest extends FormRequest
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
            'stars' => ['required', 'integer', 'between:1,5'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'stars.required' => 'Elige de 1 a 5 estrellas.',
            'stars.integer' => 'Elige de 1 a 5 estrellas.',
            'stars.between' => 'Elige de 1 a 5 estrellas.',
        ];
    }
}
