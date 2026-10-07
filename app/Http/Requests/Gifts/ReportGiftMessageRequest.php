<?php

namespace App\Http\Requests\Gifts;

use App\Domain\Moderation\Enums\ReportReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportGiftMessageRequest extends FormRequest
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
            'reason' => ['required', Rule::enum(ReportReason::class)],
            'details' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.*' => 'Elige el motivo del reporte.',
            'details.max' => 'El detalle puede tener como máximo 1000 caracteres.',
        ];
    }
}
