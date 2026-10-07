<?php

namespace App\Http\Requests\Wallet;

use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A manual wallet correction by the platform staff. The wallet is found by
 * the owner's email (listeners) or frequency (stations, "89.30" or "89-30").
 */
class AdjustWalletRequest extends FormRequest
{
    private User|Station|null $walletOwner = null;

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
            'owner_type' => ['required', 'in:user,station'],
            'owner' => ['required', 'string', 'max:255'],
            'amount_cents' => ['required', 'integer', 'not_in:0', 'between:-1000000,1000000'],
            'reason' => ['required', 'string', 'min:5', 'max:200'],
            'idempotency_key' => ['required', 'uuid'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->walletOwner = $this->findOwner();

            if ($this->walletOwner === null) {
                $validator->errors()->add('owner', $this->input('owner_type') === 'user'
                    ? 'No hay ningún usuario con ese correo.'
                    : 'No hay ninguna emisora en esa frecuencia.');
            }
        }];
    }

    public function walletOwner(): User|Station
    {
        return $this->walletOwner ?? $this->findOwner() ?? abort(404);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'owner_type.required' => 'Indica si la billetera es de un usuario o de una emisora.',
            'owner_type.in' => 'Indica si la billetera es de un usuario o de una emisora.',
            'owner.required' => 'Escribe el correo del usuario o la frecuencia de la emisora.',
            'amount_cents.required' => 'Escribe el monto del ajuste.',
            'amount_cents.integer' => 'El monto no es válido.',
            'amount_cents.not_in' => 'El monto del ajuste no puede ser cero.',
            'amount_cents.between' => 'El ajuste no puede superar US$ 10,000.00.',
            'reason.required' => 'Explica el motivo del ajuste.',
            'reason.min' => 'Explica el motivo del ajuste con al menos 5 caracteres.',
            'reason.max' => 'El motivo puede tener como máximo 200 caracteres.',
            'idempotency_key.required' => 'Actualiza la página e inténtalo de nuevo.',
            'idempotency_key.uuid' => 'Actualiza la página e inténtalo de nuevo.',
        ];
    }

    private function findOwner(): User|Station|null
    {
        $value = trim((string) $this->input('owner'));

        if ($this->input('owner_type') === 'user') {
            return User::query()->where('email', $value)->first();
        }

        $slug = str_replace('.', '-', $value);

        return Station::query()->with('frequency')->whereHas('frequency', fn ($query) => $query->where('slug', $slug))->first();
    }
}
