<?php

namespace App\Http\Requests\Public;

use App\Domain\Moderation\Enums\ReportReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportContentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(ReportReason::class)],
            'details' => [Rule::requiredIf(fn () => $this->input('reason') === ReportReason::Other->value), 'nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Elige el motivo del reporte.',
            'reason.enum' => 'Elige un motivo de la lista.',
            'details.required' => 'Cuéntanos qué ocurre.',
            'details.max' => 'El detalle no puede superar los 1000 caracteres.',
        ];
    }

    /**
     * The reasons as the report form lists them.
     *
     * @return list<array{value: string, label: string}>
     */
    public static function reasonOptions(): array
    {
        return array_map(fn (ReportReason $reason) => ['value' => $reason->value, 'label' => $reason->label()], ReportReason::cases());
    }

    public function reason(): ReportReason
    {
        return ReportReason::from($this->string('reason')->toString());
    }

    public function details(): ?string
    {
        $details = $this->string('details')->trim()->toString();

        return $details === '' ? null : $details;
    }
}
