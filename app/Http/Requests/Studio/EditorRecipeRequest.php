<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** An edit recipe from the audio editor; EditRecipe clamps every value to what the editor offers. */
class EditorRecipeRequest extends FormRequest
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
            'recipe' => ['required', 'array'],
            'recipe.cuts' => ['present', 'array', 'max:120'],
            'recipe.cuts.*' => ['array', 'size:2'],
            'recipe.cuts.*.*' => ['numeric'],
            'recipe.eq' => ['present', 'array', 'size:5'],
            'recipe.eq.*' => ['numeric'],
            'recipe.fadeIn' => ['numeric'],
            'recipe.fadeOut' => ['numeric'],
            'recipe.join' => ['numeric'],
            'recipe.gain' => ['numeric'],
            'recipe.normalize' => ['boolean'],
            'recipe.voice' => ['numeric'],
            'recipe.compress' => ['numeric'],
            'recipe.width' => ['numeric'],
            'recipe.lowcut' => ['boolean'],
            'recipe.denoise' => ['numeric'],
            'recipe.deess' => ['numeric'],
            'recipe.preset' => ['nullable', 'string', 'max:30'],
            'at' => ['sometimes', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'recipe.required' => 'No recibimos los cambios del editor.',
            'recipe.cuts.max' => 'Hay demasiados cortes; une algunos e inténtalo de nuevo.',
            'recipe.*' => 'Los cambios del editor no son válidos. Recarga la página e inténtalo de nuevo.',
            'recipe.cuts.*' => 'Uno de los cortes no es válido.',
            'recipe.cuts.*.*' => 'Uno de los cortes no es válido.',
            'recipe.eq.*' => 'El ecualizador no es válido.',
            'at.*' => 'El momento de la muestra no es válido.',
        ];
    }
}
