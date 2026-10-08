<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Library\AudioFile;

/** The console keeps its live recording: the library audio and, optionally, its episode with cover, published at once. */
class ConsoleCaptureSaveRequest extends RecordingConvertRequest
{
    public const MAX_DESCRIPTION = 2000;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'description' => ['nullable', 'string', 'max:'.self::MAX_DESCRIPTION],
            'cover' => ['nullable', 'image', 'mimes:'.implode(',', AudioFile::COVER_TYPES), 'max:'.config('platform.media.max_cover_mb') * 1024],
            'publish' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'description.max' => 'La descripción puede tener como máximo '.self::MAX_DESCRIPTION.' caracteres.',
            'cover.image' => 'La portada debe ser una imagen.',
            'cover.mimes' => 'La portada debe ser JPG, PNG o WEBP.',
            'cover.max' => 'La portada puede pesar como máximo '.config('platform.media.max_cover_mb').' MB.',
        ];
    }
}
