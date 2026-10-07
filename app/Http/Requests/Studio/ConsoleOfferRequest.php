<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** The console's WebRTC offer for one listener. */
class ConsoleOfferRequest extends FormRequest
{
    public const MAX_SDP = 20000;

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
            'id' => ['required', 'uuid'],
            'sdp' => ['required', 'string', 'max:'.self::MAX_SDP],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['id.*' => 'Ese oyente ya no está conectado.', 'sdp.*' => 'La oferta de audio no es válida.'];
    }
}
