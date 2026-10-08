<?php

namespace App\Http\Requests\Admin;

use App\Domain\Integrity\Enums\AlertStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResolveIntegrityAlertRequest extends FormRequest
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
            'outcome' => ['required', Rule::in([AlertStatus::Purged->value, AlertStatus::Dismissed->value])],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['outcome.*' => 'Elige depurar o descartar la alerta.'];
    }

    public function outcome(): AlertStatus
    {
        return AlertStatus::from((string) $this->validated('outcome'));
    }

    public function note(): ?string
    {
        $note = trim((string) $this->validated('note'));

        return $note === '' ? null : $note;
    }
}
