<?php

namespace App\Http\Requests\Stations;

use App\Domain\Discovery\Hashtags;
use App\Domain\Stations\Support\Locales;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Estudio > Perfil de radio. */
class UpdateStationProfileRequest extends FormRequest
{
    private const LINKS = ['website', 'instagram', 'facebook', 'tiktok', 'youtube', 'x'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $categories = (int) config('platform.stations.max_categories');
        $hashtags = (int) config('platform.stations.max_permanent_hashtags');

        return [
            'tagline' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:2000'],
            'accent_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'language' => ['required', Rule::in(array_keys(Locales::LANGUAGES))],
            'country' => ['nullable', Rule::in(array_keys(Locales::COUNTRIES))],
            'categories' => ['required', 'array', 'min:1', "max:{$categories}"],
            'categories.*' => ['integer', 'distinct', Rule::exists('categories', 'id')->where('active', true)],
            'hashtags' => ['array', "max:{$hashtags}"],
            'hashtags.*' => ['string', 'max:'.Hashtags::MAX_LENGTH],
            'links' => ['array'],
            ...collect(self::LINKS)->mapWithKeys(fn (string $link) => ["links.{$link}" => ['nullable', 'url:http,https', 'max:255']])->all(),
            'links.whatsapp' => ['nullable', 'regex:/^\+?[0-9 ]{7,20}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $categories = (int) config('platform.stations.max_categories');
        $hashtags = (int) config('platform.stations.max_permanent_hashtags');

        return [
            'tagline.*' => 'El eslogan puede tener como máximo 140 caracteres.',
            'description.*' => 'La descripción puede tener como máximo 2000 caracteres.',
            'accent_color.*' => 'Elige un color con el formato #RRGGBB.',
            'language.*' => 'Elige un idioma de la lista.',
            'country.*' => 'Elige un país de la lista.',
            'categories.required' => 'Elige al menos una categoría.',
            'categories.min' => 'Elige al menos una categoría.',
            'categories.max' => "Puedes elegir hasta {$categories} categorías.",
            'categories.array' => 'Elige categorías de la lista.',
            'categories.*.*' => 'Elige categorías activas de la lista, sin repetir.',
            'hashtags.max' => "Puedes tener hasta {$hashtags} hashtags permanentes.",
            'hashtags.array' => 'Escribe hashtags válidos.',
            'hashtags.*.*' => 'Cada hashtag puede tener como máximo '.Hashtags::MAX_LENGTH.' caracteres.',
            'links.whatsapp.*' => 'Escribe el WhatsApp con código de país, por ejemplo +51 999 888 777.',
            'links.*.*' => 'Escribe un enlace completo que empiece con https://',
        ];
    }

    /**
     * @return array{tagline: ?string, description: ?string, accent_color: ?string, language: string, country: ?string, categories: list<int>, hashtags: list<string>, links: array<string, ?string>}
     */
    public function profile(): array
    {
        $links = (array) $this->validated('links', []);

        return [
            'tagline' => $this->filled('tagline') ? trim((string) $this->validated('tagline')) : null,
            'description' => $this->filled('description') ? trim((string) $this->validated('description')) : null,
            'accent_color' => $this->filled('accent_color') ? strtolower((string) $this->validated('accent_color')) : null,
            'language' => (string) $this->validated('language'),
            'country' => $this->validated('country'),
            'categories' => array_values(array_map('intval', (array) $this->validated('categories'))),
            'hashtags' => array_values(array_map('strval', (array) $this->validated('hashtags', []))),
            'links' => collect([...self::LINKS, 'whatsapp'])
                ->mapWithKeys(fn (string $link) => [$link => filled($links[$link] ?? null) ? trim((string) $links[$link]) : null])
                ->all(),
        ];
    }
}
