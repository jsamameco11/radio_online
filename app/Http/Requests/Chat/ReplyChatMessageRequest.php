<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

/** The station team writes in its chat as the station, optionally answering one message. */
class ReplyChatMessageRequest extends FormRequest
{
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
            'body' => ['required', 'string', 'max:'.config('platform.chat.max_message_length')],
            'client_key' => ['required', 'string', 'min:16', 'max:64', 'regex:/^[A-Za-z0-9-]+$/'],
            'reply_to' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Escribe un mensaje.',
            'body.max' => 'El mensaje puede tener como máximo :max caracteres.',
            'client_key.*' => 'Actualiza la página e inténtalo de nuevo.',
            'reply_to.uuid' => 'Ese mensaje no es de este chat.',
        ];
    }
}
