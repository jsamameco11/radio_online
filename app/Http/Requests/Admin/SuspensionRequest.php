<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Suspending a station or an account always records why. */
class SuspensionRequest extends FormRequest
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
        return ['reason' => ['required', 'string', 'min:5', 'max:300']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['reason.*' => 'Explica el motivo de la suspensión (entre 5 y 300 caracteres).'];
    }
}
