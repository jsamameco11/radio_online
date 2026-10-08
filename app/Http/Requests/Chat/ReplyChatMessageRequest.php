<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\Enums\ChatSticker;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** The station team writes in its chat as the station (text, a sticker or both), optionally answering one message. */
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
            'body' => ['nullable', 'required_without:sticker', 'string', 'max:'.config('platform.chat.max_message_length')],
            'sticker' => ['nullable', Rule::enum(ChatSticker::class)],
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
            'body.required_without' => 'Escribe un mensaje o elige un sticker.',
            'body.max' => 'El mensaje puede tener como máximo :max caracteres.',
            'sticker.*' => 'Elige uno de los stickers disponibles.',
            'client_key.*' => 'Actualiza la página e inténtalo de nuevo.',
            'reply_to.uuid' => 'Ese mensaje no es de este chat.',
        ];
    }

    public function sticker(): ?ChatSticker
    {
        return $this->enum('sticker', ChatSticker::class);
    }
}
