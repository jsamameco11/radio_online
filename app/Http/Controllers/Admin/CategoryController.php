<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Discovery\Actions\DeleteCategory;
use App\Domain\Discovery\Actions\MoveCategory;
use App\Domain\Discovery\Actions\SaveCategory;
use App\Domain\Discovery\Enums\CategoryGroup;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCategoryRequest;
use App\Http\Resources\Admin\CategoryResource;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Categorías: the station categories listeners browse, grouped and ordered. */
class CategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $categories = Category::query()->withCount('stations')->orderBy('sort_order')->orderBy('name')->get();

        return Inertia::render('Admin/Categories/Index', [
            'groups' => collect(CategoryGroup::cases())
                ->map(fn (CategoryGroup $group) => [
                    'value' => $group->value,
                    'label' => $group->label(),
                    'categories' => $categories
                        ->filter(fn (Category $category) => $category->group === $group)
                        ->map(fn (Category $category) => CategoryResource::make($category)->resolve($request))
                        ->values()
                        ->all(),
                ])
                ->all(),
        ]);
    }

    public function store(SaveCategoryRequest $request, SaveCategory $save): RedirectResponse
    {
        $category = $save->handle(null, $request->category(), $request->user());

        return back()->with('success', "Creaste la categoría {$category->name}.");
    }

    public function update(SaveCategoryRequest $request, Category $category, SaveCategory $save): RedirectResponse
    {
        $save->handle($category, $request->category(), $request->user());

        return back()->with('success', 'Guardamos los cambios de la categoría.');
    }

    public function destroy(Request $request, Category $category, DeleteCategory $delete): RedirectResponse
    {
        $delete->handle($category, $request->user());

        return back()->with('success', "Eliminaste la categoría {$category->name}.");
    }

    public function move(Request $request, Category $category, MoveCategory $move): RedirectResponse
    {
        $move->handle($category, $request->input('direction') === 'up');

        return back();
    }
}
