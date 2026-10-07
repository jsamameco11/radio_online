<?php

namespace App\Http\Requests\Stations;

use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Perfil de radio: logo, avatar, cover or banner. */
class UploadStationImageRequest extends FormRequest
{
    public const MAX_KILOBYTES = 5120;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_KILOBYTES, 'dimensions:min_width=128,min_height=128']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'image.required' => 'Elige una imagen.',
            'image.max' => 'La imagen puede pesar como máximo 5 MB.',
            'image.dimensions' => 'La imagen debe medir al menos 128 × 128 píxeles.',
            'image.*' => 'Sube una imagen JPG, PNG o WebP.',
        ];
    }
}
