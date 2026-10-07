<?php

namespace App\Http\Requests\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use Illuminate\Foundation\Http\FormRequest;

/** Which library audios fill the pad bank, in order. */
class ConsolePadsRequest extends FormRequest
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
            'tracks' => ['present', 'array', 'max:'.LiveDesk::MAX_PADS],
            'tracks.*' => ['uuid', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tracks.max' => 'La botonera tiene hasta '.LiveDesk::MAX_PADS.' botones.',
            'tracks.*' => 'Hay un audio repetido o que no es válido.',
        ];
    }
}
