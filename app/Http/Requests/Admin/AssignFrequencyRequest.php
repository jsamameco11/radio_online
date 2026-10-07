<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ValidatesStationDetails;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin > Frecuencias > Asignar: opens a station for an existing account. */
class AssignFrequencyRequest extends FormRequest
{
    use ValidatesStationDetails;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $max = (int) config('platform.stations.max_categories');

        return [
            'email' => ['required', 'email', 'max:255', function (string $attribute, mixed $value, Closure $fail) {
                if ($this->owner() === null) {
                    $fail('No encontramos una cuenta con ese correo.');
                }
            }],
            'name' => $this->stationDetailsRules(null)['name'],
            'categories' => ['array', "max:{$max}"],
            'categories.*' => ['integer', 'distinct', Rule::exists('categories', 'id')->where('active', true)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $max = (int) config('platform.stations.max_categories');

        return [
            ...$this->stationDetailsMessages(),
            'email.required' => 'Escribe el correo de la cuenta que recibirá la emisora.',
            'email.email' => 'Escribe un correo válido.',
            'email.max' => 'Escribe un correo válido.',
            'categories.max' => "Elige hasta {$max} categorías.",
            'categories.*.*' => 'Elige categorías activas de la lista, sin repetir.',
        ];
    }

    public function owner(): ?User
    {
        return User::query()->whereRaw('lower(email) = ?', [mb_strtolower(trim((string) $this->input('email')))])->first();
    }

    /**
     * @return list<int>
     */
    public function categoryIds(): array
    {
        return array_values(array_map('intval', (array) $this->validated('categories', [])));
    }
}
