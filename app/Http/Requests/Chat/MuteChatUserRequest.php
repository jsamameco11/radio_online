<?php

namespace App\Http\Requests\Chat;

use App\Domain\Chat\Actions\MuteChatUser;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Silence a listener of the chat for one of the offered terms, or until the team lifts it. */
class MuteChatUserRequest extends FormRequest
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
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'minutes' => ['nullable', 'integer', Rule::in(MuteChatUser::TERMS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.*' => 'No encontramos a ese oyente.',
            'minutes.*' => 'Elige por cuánto tiempo silenciarlo.',
        ];
    }

    public function minutes(): ?int
    {
        return $this->filled('minutes') ? $this->integer('minutes') : null;
    }
}
