<?php

namespace App\Http\Requests\Public;

/** A listener asks for the live microphone of a session, or answers the console's offer with its SDP. */
class ListenVoiceRequest extends ListenerRequest
{
    public const MAX_SDP = 20000;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'session' => ['required', 'string', 'max:40'],
            'sdp' => [$this->routeIs('listen.voice.answer') ? 'required' : 'prohibited', 'string', 'max:'.self::MAX_SDP],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'session.*' => 'La transmisión en vivo ya terminó.',
            'sdp.*' => 'Respuesta inválida.',
        ];
    }
}
