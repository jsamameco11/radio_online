<?php

namespace App\Http\Requests\Public;

/** A listener's player could not play an audio of the station. */
class ListenFailureRequest extends ListenerRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [...parent::rules(), 'track' => ['required', 'uuid']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [...parent::messages(), 'track.*' => 'Ese audio no está en la radio.'];
    }
}
