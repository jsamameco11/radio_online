<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\Enums\ChatSticker;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A listener's chat message: the text, a sticker or both, the key the
 * composer generated (a retried request posts once) and, to highlight it,
 * the tier price. The price is checked against the configured tiers by
 * PostChatMessage.
 */
class PostChatMessageRequest extends FormRequest
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
            'highlight_cents' => ['nullable', 'integer', 'min:1'],
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
            'highlight_cents.*' => 'Elige uno de los montos de destacado disponibles.',
        ];
    }

    public function highlightCents(): ?int
    {
        return $this->filled('highlight_cents') ? $this->integer('highlight_cents') : null;
    }

    public function sticker(): ?ChatSticker
    {
        return $this->enum('sticker', ChatSticker::class);
    }
}
