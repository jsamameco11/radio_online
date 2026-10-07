<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Enums\TrackKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** The audios of an upload batch, to tell which are already in the library. */
class LibraryDuplicatesRequest extends FormRequest
{
    public const MAX_ITEMS = 100;

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
            'items' => ['required', 'array', 'max:'.self::MAX_ITEMS],
            'items.*.key' => ['required', 'string', 'max:64', 'distinct'],
            'items.*.kind' => ['required', Rule::enum(TrackKind::class)],
            'items.*.title' => ['required', 'string', 'max:200'],
            'items.*.artist' => ['nullable', 'string', 'max:300'],
            'items.*.duration' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'ignore' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'No hay audios para revisar.',
            'items.max' => 'Revisa como máximo '.self::MAX_ITEMS.' audios a la vez.',
            'items.*' => 'Uno de los audios no tiene datos válidos.',
            'items.*.*' => 'Uno de los audios no tiene datos válidos.',
            'ignore.*' => 'El audio no es válido.',
        ];
    }
}
