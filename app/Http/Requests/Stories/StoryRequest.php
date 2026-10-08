<?php

namespace App\Http\Requests\Stories;

use App\Domain\Stories\Enums\StoryBackground;
use App\Domain\Stories\Enums\StoryKind;
use App\Domain\Stories\Support\StoryLimits;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoryRequest extends FormRequest
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
        $kind = $this->input('kind');
        $imageTypes = implode(',', config('platform.stories.image_types'));
        $imageMax = (int) config('platform.stories.max_image_mb') * 1024;

        return [
            'kind' => ['required', Rule::enum(StoryKind::class)],
            'text' => [$kind === StoryKind::Text->value ? 'required' : 'nullable', 'string', 'max:'.StoryLimits::maxText()],
            'background' => [$kind === StoryKind::Text->value ? 'required' : 'nullable', Rule::enum(StoryBackground::class)],
            'media' => match ($kind) {
                StoryKind::Image->value => ['required', 'file', 'image', 'mimes:'.$imageTypes, 'max:'.$imageMax],
                StoryKind::Video->value => [
                    'required', 'file',
                    'mimetypes:'.implode(',', config('platform.stories.video_mimetypes')),
                    'max:'.(int) config('platform.stories.max_video_mb') * 1024,
                ],
                default => ['prohibited'],
            },
            'poster' => [$kind === StoryKind::Video->value ? 'nullable' : 'prohibited', 'file', 'image', 'mimes:'.$imageTypes, 'max:'.$imageMax],
            'duration' => [$kind === StoryKind::Video->value ? 'required' : 'nullable', 'numeric', 'min:0.5', 'max:3600'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $maxText = StoryLimits::maxText();

        return [
            'kind.*' => 'Elige si publicas una foto, un video o un texto.',
            'text.required' => 'Escribe el texto del estado.',
            'text.max' => "El texto puede tener como máximo {$maxText} caracteres.",
            'background.*' => 'Elige un fondo para el texto.',
            'media.required' => 'Elige la foto o el video del estado.',
            'media.file' => 'El archivo no llegó completo. Inténtalo de nuevo.',
            'media.image' => 'La foto debe ser JPG, PNG o WEBP.',
            'media.mimes' => 'La foto debe ser JPG, PNG o WEBP.',
            'media.mimetypes' => 'El video debe ser MP4, WEBM o MOV.',
            'media.max' => $this->input('kind') === StoryKind::Video->value
                ? 'El video puede pesar como máximo '.config('platform.stories.max_video_mb').' MB.'
                : 'La foto puede pesar como máximo '.config('platform.stories.max_image_mb').' MB.',
            'media.prohibited' => 'Un estado de texto no lleva archivo.',
            'poster.*' => 'La portada del video no es válida.',
            'duration.required' => 'No pudimos leer la duración del video. Revisa que el archivo no esté dañado.',
            'duration.*' => 'La duración del video no es válida.',
        ];
    }
}
