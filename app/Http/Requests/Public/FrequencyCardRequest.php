<?php

namespace App\Http\Requests\Public;

use App\Domain\Payments\Support\ChargeAttempt;
use App\Models\FrequencyRequest;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The card token of a priced frequency (to keep on file, or to pay after a
 * decline) and, after a 3-D Secure challenge, its result. Never an amount:
 * the price is the one the request was sent with.
 */
class FrequencyCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        $request = $this->route('frequencyRequest');

        return $request instanceof FrequencyRequest && (bool) $this->user()?->can('pay', $request);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9_]+$/'],
            'email' => ['nullable', 'email', 'max:50'],
            'authentication_3DS' => ['nullable', 'array:eci,xid,cavv,protocolVersion,directoryServerTransactionId'],
            'authentication_3DS.*' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function attempt(): ChargeAttempt
    {
        $authentication = $this->validated('authentication_3DS');

        return new ChargeAttempt(
            (string) $this->validated('token'),
            (string) ($this->validated('email') ?: $this->user()->email),
            is_array($authentication) ? array_map('strval', array_filter($authentication, fn ($value) => $value !== null)) : null,
        );
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'token.required' => 'No recibimos los datos de tu tarjeta. Vuelve a intentarlo.',
            'token.*' => 'Los datos de tu tarjeta no son válidos. Vuelve a intentarlo.',
            'email.*' => 'El correo del pago no es válido.',
            'authentication_3DS.*' => 'La verificación de tu banco no es válida. Vuelve a intentarlo.',
        ];
    }
}
