<?php

namespace App\Http\Requests\Admin;

use App\Domain\Discovery\Enums\CategoryGroup;
use App\Models\Category;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin > Categorías: create or edit. */
class SaveCategoryRequest extends FormRequest
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
        /** @var Category|null $category */
        $category = $this->route('category');

        return [
            'name' => ['required', 'string', 'min:2', 'max:60', function (string $attribute, mixed $value, Closure $fail) use ($category) {
                $taken = Category::query()
                    ->whereRaw('lower(name) = ?', [mb_strtolower(trim((string) $value))])
                    ->when($category !== null, fn ($query) => $query->whereKeyNot($category->id))
                    ->exists();

                if ($taken) {
                    $fail('Ya existe una categoría con ese nombre.');
                }
            }],
            'group' => ['required', Rule::enum(CategoryGroup::class)],
            'active' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Escribe el nombre de la categoría.',
            'name.min' => 'El nombre debe tener al menos 2 caracteres.',
            'name.max' => 'El nombre puede tener como máximo 60 caracteres.',
            'group.*' => 'Elige un grupo de la lista.',
            'active.*' => 'Indica si la categoría está activa.',
        ];
    }

    /**
     * @return array{name: string, group: string, active: bool}
     */
    public function category(): array
    {
        return [
            'name' => trim((string) $this->validated('name')),
            'group' => (string) $this->validated('group'),
            'active' => $this->boolean('active'),
        ];
    }
}
