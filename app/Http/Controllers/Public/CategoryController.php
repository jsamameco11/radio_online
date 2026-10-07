<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Enums\StationSort;
use App\Domain\Discovery\Queries\CategoryCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Discovery\Queries\StationFilters;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ExploreStationsRequest;
use App\Http\Resources\StationResource;
use App\Models\Category;
use App\Models\Station;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(CategoryCatalog $categories): Response
    {
        return Inertia::render('Public/Categories', [
            'groups' => $categories->grouped(),
        ]);
    }

    public function show(ExploreStationsRequest $request, Category $category, StationDirectory $stations, CategoryCatalog $categories): Response
    {
        abort_unless($category->active, 404);

        $requested = $request->filters();
        $filters = new StationFilters(category: $category->slug, onAirOnly: $requested->onAirOnly, sort: $requested->sort);
        $related = Category::query()
            ->active()
            ->where('group', $category->group->value)
            ->whereKeyNot($category->id)
            ->withCount(['stations' => fn ($station) => $station->discoverable()])
            ->get()
            ->filter(fn (Category $other) => $other->stations_count > 0)
            ->take(12);

        return Inertia::render('Public/Category', [
            'category' => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'group' => $category->group->label(),
            ],
            'stations' => $stations->search($filters)->through(fn (Station $station) => StationResource::make($station)->resolve($request)),
            'filters' => $request->applied($filters),
            'sorts' => array_map(fn (StationSort $sort) => ['value' => $sort->value, 'label' => $sort->label()], StationSort::cases()),
            'related' => $related->map(fn (Category $other) => $categories->present($other))->values()->all(),
        ]);
    }
}
