<?php

namespace App\Http\Requests\Gifts;

use Illuminate\Foundation\Http\FormRequest;

/** Studio › Configuración › Regalos. */
class GiftSettingsRequest extends FormRequest
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
            'enabled' => ['required', 'boolean'],
            'min_gift_cents' => ['required', 'integer', 'between:100,100000'],
            'thank_you_message' => ['nullable', 'string', 'max:200'],
        ];
    }

    /**
     * @return array{enabled: bool, min_gift_cents: int, thank_you_message: string}
     */
    public function settings(): array
    {
        return [
            'enabled' => $this->boolean('enabled'),
            'min_gift_cents' => (int) $this->validated('min_gift_cents'),
            'thank_you_message' => trim((string) $this->validated('thank_you_message')),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'enabled.*' => 'Indica si la emisora acepta regalos.',
            'min_gift_cents.*' => 'El regalo mínimo debe estar entre US$ 1.00 y US$ 1,000.00.',
            'thank_you_message.max' => 'El mensaje de agradecimiento puede tener como máximo 200 caracteres.',
        ];
    }
}
