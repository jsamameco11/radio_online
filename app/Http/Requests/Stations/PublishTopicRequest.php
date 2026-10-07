<?php

namespace App\Http\Requests\Stations;

use App\Domain\Discovery\Hashtags;
use Illuminate\Foundation\Http\FormRequest;

/** "¿Qué está pasando ahora?": the topic title and its temporary hashtags. */
class PublishTopicRequest extends FormRequest
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
        $max = (int) config('platform.stations.max_topic_hashtags');

        return [
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'hashtags' => ['array', "max:{$max}"],
            'hashtags.*' => ['string', 'max:'.Hashtags::MAX_LENGTH],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $max = (int) config('platform.stations.max_topic_hashtags');

        return [
            'title.required' => 'Cuéntales a tus oyentes de qué están hablando.',
            'title.min' => 'El tema debe tener al menos 3 caracteres.',
            'title.max' => 'El tema puede tener como máximo 160 caracteres.',
            'title.string' => 'Escribe un tema válido.',
            'hashtags.max' => "Puedes usar hasta {$max} hashtags por tema.",
            'hashtags.array' => 'Escribe hashtags válidos.',
            'hashtags.*.*' => 'Cada hashtag puede tener como máximo '.Hashtags::MAX_LENGTH.' caracteres.',
        ];
    }

    public function title(): string
    {
        return trim((string) $this->validated('title'));
    }

    /**
     * @return list<string>
     */
    public function hashtags(): array
    {
        return array_values(array_map('strval', (array) $this->validated('hashtags', [])));
    }
}
