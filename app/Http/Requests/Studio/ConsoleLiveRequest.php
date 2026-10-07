<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Opens the live session of the console. */
class ConsoleLiveRequest extends FormRequest
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
            'host' => ['nullable', 'string', 'max:80'],
            'title' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['host' => 'nombre del locutor', 'title' => 'nombre del programa'];
    }

    public function host(): string
    {
        return trim((string) $this->validated('host')) ?: $this->user()->name;
    }

    public function title(): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', (string) $this->validated('title')));
    }
}
