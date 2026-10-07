<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:min_width=64,min_height=64'],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Elige una imagen.',
            'avatar.image' => 'El archivo debe ser una imagen.',
            'avatar.mimes' => 'Usa una imagen JPG, PNG o WebP.',
            'avatar.max' => 'La imagen no puede pesar más de 2 MB.',
            'avatar.dimensions' => 'La imagen debe medir al menos 64 × 64 píxeles.',
        ];
    }
}
