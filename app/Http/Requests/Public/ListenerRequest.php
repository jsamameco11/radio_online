<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A request of a station player. "oyente" is the id the player draws when it starts playing:
 * it names its listening session and its live-microphone connection.
 */
class ListenerRequest extends FormRequest
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
        return ['oyente' => [$this->listenerRequired() ? 'required' : 'nullable', 'uuid']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['oyente.*' => 'Vuelve a darle play para seguir escuchando.'];
    }

    public function listener(): ?string
    {
        $id = $this->validated('oyente');

        return is_string($id) ? strtolower($id) : null;
    }

    protected function listenerRequired(): bool
    {
        return ! $this->isMethod('GET');
    }
}
