<?php

namespace App\Http\Requests\Admin;

use App\Domain\Frequencies\Actions\ExpandDial;
use App\Models\Frequency;
use Illuminate\Foundation\Http\FormRequest;

/** Admin > Frecuencias > Ampliar el dial. */
class ExpandDialRequest extends FormRequest
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
        $min = Frequency::query()->count() + 1;
        $max = ExpandDial::capacity();

        return ['size' => ['required', 'integer', "min:{$min}", "max:{$max}"]];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $current = Frequency::query()->count();
        $max = number_format(ExpandDial::capacity());

        return [
            'size.required' => 'Indica cuántas frecuencias debe tener el dial.',
            'size.integer' => 'Indica un número entero de frecuencias.',
            'size.min' => "El dial ya tiene {$current} frecuencias: indica un número mayor.",
            'size.max' => "El dial admite como máximo {$max} frecuencias.",
        ];
    }
}
