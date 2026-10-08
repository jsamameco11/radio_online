<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Catalog\GenreFamily;
use App\Http\Requests\Studio\Concerns\SplitsCatalogNames;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CatalogGenreRequest extends FormRequest
{
    use SplitsCatalogNames;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) preg_replace('/\s+/u', ' ', (string) $this->input('name'))),
            'aliases' => $this->names($this->input('aliases')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'family' => ['required', Rule::enum(GenreFamily::class)],
            'aliases' => ['array', 'max:'.self::MAX_NAMES],
            'aliases.*' => ['string', 'max:60'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre del estilo.',
            'name.min' => 'Escribe el nombre del estilo.',
            'name.max' => 'El nombre del estilo puede tener como máximo 60 caracteres.',
            'family.*' => 'Elige la familia del estilo.',
            'aliases.max' => 'Son demasiados nombres alternativos: deja hasta '.self::MAX_NAMES.'.',
            'aliases.*' => 'Cada nombre alternativo puede tener como máximo 60 caracteres.',
        ];
    }
}
