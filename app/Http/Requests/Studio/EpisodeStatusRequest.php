<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\EpisodeStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EpisodeStatusRequest extends FormRequest
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
            'status' => ['required', Rule::enum(EpisodeStatus::class)],
            'publish_at' => ['nullable', 'required_if:status,'.EpisodeStatus::Scheduled->value, 'date', 'after:now'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.*' => 'Elige el estado del episodio.',
            'publish_at.required_if' => 'Elige cuándo se publicará el episodio.',
            'publish_at.date' => 'La fecha de publicación no es válida.',
            'publish_at.after' => 'La fecha de publicación debe ser futura.',
        ];
    }
}
