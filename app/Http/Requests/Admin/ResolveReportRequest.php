<?php

namespace App\Http\Requests\Admin;

use App\Domain\Moderation\Enums\ReportStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin > Moderación: resolve or dismiss a report, with an optional note. */
class ResolveReportRequest extends FormRequest
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
            'outcome' => ['required', Rule::in([ReportStatus::Resolved->value, ReportStatus::Dismissed->value])],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'outcome.*' => 'Elige resolver o descartar el reporte.',
            'note.*' => 'La nota puede tener como máximo 500 caracteres.',
        ];
    }

    public function outcome(): ReportStatus
    {
        return ReportStatus::from((string) $this->validated('outcome'));
    }
}
