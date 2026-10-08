<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Actions\AddFactoryEffect;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A factory effect of the console to keep in the library (and the pad bank with «pad»). The
 * rendered audio only comes when the server asked for it: nobody stored that effect yet.
 */
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
            'id' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/'],
            'version' => ['required', 'string', 'regex:/^[a-f0-9]{'.AddFactoryEffect::VERSION_LENGTH.'}$/'],
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:60'],
            'duration' => ['required', 'numeric', 'between:0.1,'.self::MAX_SECONDS],
            'pad' => ['sometimes', 'boolean'],
            'audio' => ['sometimes', 'file', 'max:'.self::MAX_KILOBYTES],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'id.*' => 'Ese efecto no es válido. Recarga la página.',
            'version.*' => 'Ese efecto no es válido. Recarga la página.',
            'title.*' => 'Ese efecto no es válido. Recarga la página.',
            'category.*' => 'Ese efecto no es válido. Recarga la página.',
            'duration.*' => 'Ese efecto no es válido. Recarga la página.',
            'audio.max' => 'El efecto pesa demasiado.',
            'audio.*' => 'No llegó el audio del efecto. Inténtalo de nuevo.',
        ];
    }
}
