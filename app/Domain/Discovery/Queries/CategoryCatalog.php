<?php

namespace App\Domain\Discovery\Queries;

use App\Domain\Discovery\Enums\CategoryGroup;
use App\Models\Category;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/** Station styles with how many public stations carry each one. */
final class CategoryCatalog
{
    /**
     * Categories with the most stations, for the home page.
     *
     * @return list<array{id: int, name: string, slug: string, group: string, station_count: int}>
     */
    public function featured(int $limit): array
    {
        return $this->counted()
            ->get()
            ->filter(fn (Category $category) => $category->stations_count > 0)
            ->sortByDesc('stations_count')
            ->take($limit)
            ->map(fn (Category $category) => $this->present($category))
            ->values()
            ->all();
    }

    /**
     * Every active category, by group.
     *
     * @return list<array{value: string, label: string, categories: list<array{id: int, name: string, slug: string, group: string, station_count: int}>}>
     */
    public function grouped(): array
    {
        $categories = $this->counted()->get()->groupBy(fn (Category $category) => $category->group->value);

        return collect(CategoryGroup::cases())
            ->filter(fn (CategoryGroup $group) => $categories->has($group->value))
            ->map(fn (CategoryGroup $group) => [
                'value' => $group->value,
                'label' => $group->label(),
                'categories' => $categories->get($group->value, new Collection)
                    ->map(fn (Category $category) => $this->present($category))
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, name: string, slug: string, group: string, station_count: int}
     */
    public function present(Category $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'group' => $category->group->label(),
            'station_count' => (int) ($category->stations_count ?? 0),
        ];
    }

    /** @return Builder<Category> */
    private function counted(): Builder
    {
        return Category::query()
            ->active()
            ->withCount(['stations' => fn (Builder $station) => $station->discoverable()]);
    }
}
