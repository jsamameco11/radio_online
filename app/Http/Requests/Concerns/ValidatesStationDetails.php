<?php

namespace App\Http\Requests\Concerns;

use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Stations\Support\Locales;
use App\Models\Station;
use Closure;
use Illuminate\Validation\Rule;

/** Rules and messages for the public details of a station, shared by the studio and the admin panel. */
trait ValidatesStationDetails
{
    /**
     * @return array<string, mixed>
     */
    protected function stationDetailsRules(?Station $station): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:80', $this->uniqueStationName($station)],
            'tagline' => ['nullable', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:2000'],
            'visibility' => ['required', Rule::enum(StationVisibility::class)],
            'accent_color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'language' => ['required', Rule::in(array_keys(Locales::LANGUAGES))],
            'country' => ['nullable', Rule::in(array_keys(Locales::COUNTRIES))],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function stationDetailsMessages(): array
    {
        return [
            'name.required' => 'Escribe el nombre público de la emisora.',
            'name.min' => 'El nombre debe tener al menos 3 caracteres.',
            'name.max' => 'El nombre puede tener como máximo 80 caracteres.',
            'name.string' => 'Escribe un nombre válido.',
            'tagline.*' => 'El eslogan puede tener como máximo 140 caracteres.',
            'description.*' => 'La descripción puede tener como máximo 2000 caracteres.',
            'visibility.*' => 'Elige si la emisora es pública o solo con enlace.',
            'accent_color.*' => 'Elige un color con el formato #RRGGBB.',
            'language.*' => 'Elige un idioma de la lista.',
            'country.*' => 'Elige un país de la lista.',
        ];
    }

    private function uniqueStationName(?Station $station): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($station) {
            $taken = Station::query()
                ->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) $value))])
                ->when($station !== null, fn ($query) => $query->whereKeyNot($station->id))
                ->exists();

            if ($taken) {
                $fail('Ya existe una emisora con ese nombre. Elige otro.');
            }
        };
    }
}
