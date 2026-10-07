<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Support\StationPreferences;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A station settings group made of yes/no switches (plus who receives the
 * notifications), validated against the group defaults.
 */
abstract class UpdatePreferencesRequest extends FormRequest
{
    abstract public function group(): string;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return collect(StationPreferences::DEFAULTS[$this->group()])
            ->map(fn (mixed $default, string $key) => $key === 'recipients'
                ? ['required', Rule::in(array_keys(StationPreferences::RECIPIENTS))]
                : ['required', 'boolean'])
            ->all();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'recipients.*' => 'Elige quién recibe los avisos.',
            '*.boolean' => 'Indica sí o no.',
            '*.required' => 'Completa esta opción.',
        ];
    }

    /**
     * @return array<string, bool|string>
     */
    public function settings(): array
    {
        return collect(StationPreferences::DEFAULTS[$this->group()])
            ->map(fn (mixed $default, string $key) => $key === 'recipients' ? (string) $this->validated($key) : $this->boolean($key))
            ->all();
    }
}
