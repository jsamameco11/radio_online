<?php

namespace App\Http\Requests\Gifts;

use Illuminate\Foundation\Http\FormRequest;

class MessageVisibilityRequest extends FormRequest
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
            'visible' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'visible.*' => 'Indica si el mensaje debe mostrarse u ocultarse.',
        ];
    }
}
