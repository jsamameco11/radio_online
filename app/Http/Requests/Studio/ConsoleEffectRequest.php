<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** A factory effect rendered by the browser, to keep in the library and the pad bank. */
class ConsoleEffectRequest extends FormRequest
{
    public const MAX_SECONDS = 30;

    public const MAX_KILOBYTES = 6 * 1024;

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
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:60'],
            'duration' => ['required', 'numeric', 'between:0.1,'.self::MAX_SECONDS],
            'audio' => ['sometimes', 'file', 'max:'.self::MAX_KILOBYTES],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.*' => 'Ese efecto no es válido. Recarga la página.',
            'category.*' => 'Ese efecto no es válido. Recarga la página.',
            'duration.*' => 'Ese efecto no es válido. Recarga la página.',
            'audio.max' => 'El efecto pesa demasiado.',
            'audio.*' => 'No llegó el audio del efecto. Inténtalo de nuevo.',
        ];
    }
}
