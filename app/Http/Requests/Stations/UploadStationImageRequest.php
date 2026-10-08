<?php

namespace App\Http\Requests\Stations;

use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Perfil de radio: the logo or the cover photo. */
class UploadStationImageRequest extends FormRequest
{
    public const MAX_KILOBYTES = 5120;

    /** Smallest size per slot, [width, height] in pixels: the cover fills a wide strip. */
    public const MIN_SIZE = ['logo' => [128, 128], 'cover' => [960, 320]];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        [$width, $height] = $this->minSize();

        return ['image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_KILOBYTES, "dimensions:min_width={$width},min_height={$height}"]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        [$width, $height] = $this->minSize();

        return [
            'image.required' => 'Elige una imagen.',
            'image.max' => 'La imagen puede pesar como máximo 5 MB.',
            'image.dimensions' => $this->route('slot') === 'cover'
                ? "La foto de portada debe ser horizontal y medir al menos {$width} × {$height} píxeles."
                : "La imagen debe medir al menos {$width} × {$height} píxeles.",
            'image.*' => 'Sube una imagen JPG, PNG o WebP.',
        ];
    }

    /** @return array{int, int} */
    private function minSize(): array
    {
        return self::MIN_SIZE[$this->route('slot')] ?? self::MIN_SIZE['logo'];
    }
}
