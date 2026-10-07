<?php

namespace App\Http\Requests\Gifts;

use App\Domain\Gifts\Actions\SendGift;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The gift modal: which gift, how many, an optional text and/or voice note
 * recorded in the browser, and the idempotency key the modal generated.
 */
class SendGiftRequest extends FormRequest
{
    /** What browsers record (WebM/Ogg/MP4) as file sniffing reports it. */
    public const VOICE_MIMES = [
        'audio/webm', 'video/webm', 'audio/ogg', 'audio/mp4', 'video/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav', 'audio/x-wav',
    ];

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
            'gift_id' => ['required', 'integer', 'exists:gifts,id'],
            'quantity' => ['required', 'integer', 'between:1,'.SendGift::MAX_QUANTITY],
            'idempotency_key' => ['required', 'string', 'min:16', 'max:64', 'regex:/^[A-Za-z0-9-]+$/'],
            'message' => ['nullable', 'string', 'max:'.config('platform.gifts.max_message_length')],
            'voice' => ['nullable', 'file', 'mimetypes:'.implode(',', self::VOICE_MIMES), 'max:'.config('platform.gifts.max_voice_kilobytes')],
            'voice_duration' => ['required_with:voice', 'nullable', 'numeric', 'gt:0', 'max:'.config('platform.gifts.max_voice_seconds')],
            'anonymous' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $seconds = config('platform.gifts.max_voice_seconds');

        return [
            'gift_id.required' => 'Elige un regalo.',
            'gift_id.exists' => 'Este regalo ya no está disponible.',
            'quantity.required' => 'Indica cuántos regalos quieres enviar.',
            'quantity.between' => 'Puedes enviar de 1 a '.SendGift::MAX_QUANTITY.' unidades del regalo.',
            'idempotency_key.*' => 'Actualiza la página e inténtalo de nuevo.',
            'message.max' => 'El mensaje puede tener como máximo :max caracteres.',
            'voice.file' => 'No pudimos recibir tu mensaje de voz. Grábalo de nuevo.',
            'voice.mimetypes' => 'El mensaje de voz debe ser un audio grabado desde el navegador.',
            'voice.max' => 'El mensaje de voz es demasiado pesado.',
            'voice_duration.required_with' => 'No pudimos medir la duración de tu mensaje de voz. Grábalo de nuevo.',
            'voice_duration.*' => "El mensaje de voz puede durar como máximo {$seconds} segundos.",
        ];
    }
}
