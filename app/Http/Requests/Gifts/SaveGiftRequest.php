<?php

namespace App\Http\Requests\Gifts;

use Illuminate\Foundation\Http\FormRequest;

/** A gift of the catalog, as the platform staff edits it. */
class SaveGiftRequest extends FormRequest
{
    public const ANIMATIONS = ['float', 'pulse', 'bloom', 'bounce', 'shine', 'crown', 'launch'];

    public const MIN_PRICE_CENTS = 100;

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
            'name' => ['required', 'string', 'max:40'],
            'emoji' => ['required', 'string', 'max:16'],
            'price_cents' => ['required', 'integer', 'min:'.self::MIN_PRICE_CENTS, 'max:1000000'],
            'animation' => ['nullable', 'in:'.implode(',', self::ANIMATIONS)],
            'sort_order' => ['required', 'integer', 'between:0,1000'],
            'active' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array{name: string, emoji: string, price_cents: int, animation: string|null, sort_order: int, active: bool}
     */
    public function gift(): array
    {
        return [
            'name' => trim((string) $this->validated('name')),
            'emoji' => trim((string) $this->validated('emoji')),
            'price_cents' => (int) $this->validated('price_cents'),
            'animation' => $this->validated('animation'),
            'sort_order' => (int) $this->validated('sort_order'),
            'active' => $this->boolean('active'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del regalo.',
            'name.max' => 'El nombre puede tener como máximo 40 caracteres.',
            'emoji.required' => 'Elige el emoji del regalo.',
            'emoji.max' => 'Usa un solo emoji.',
            'price_cents.required' => 'Escribe el precio del regalo.',
            'price_cents.integer' => 'El precio no es válido.',
            'price_cents.min' => 'El precio mínimo de un regalo es US$ 1.00.',
            'price_cents.max' => 'El precio máximo de un regalo es US$ 10,000.00.',
            'animation.in' => 'Elige una animación de la lista.',
            'sort_order.*' => 'El orden debe ser un número entre 0 y 1000.',
            'active.*' => 'Indica si el regalo está activo.',
        ];
    }
}
