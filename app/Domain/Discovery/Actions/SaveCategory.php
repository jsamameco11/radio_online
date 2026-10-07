<?php

namespace App\Domain\Discovery\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Discovery\Enums\CategoryGroup;
use App\Models\Category;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Creates or edits a station category. New categories go last in their
 * group; the slug is set once, so public links keep working after a rename.
 */
final class SaveCategory
{
    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @param  array{name: string, group: string, active: bool}  $data
     */
    public function handle(?Category $category, array $data, User $actor): Category
    {
        $group = CategoryGroup::from($data['group']);
        $creating = $category === null;
        $category ??= new Category(['slug' => $this->uniqueSlug($data['name'])]);

        if ($creating || $category->group !== $group) {
            $category->sort_order = (int) Category::query()->where('group', $group->value)->max('sort_order') + 1;
        }

        $category->fill(['name' => $data['name'], 'group' => $group, 'active' => $data['active']]);
        $dirty = array_keys($category->getDirty());
        $category->save();

        if ($creating || $dirty !== []) {
            $this->audit->record($creating ? 'category.created' : 'category.updated', $category, ['name' => $category->name, 'fields' => $dirty], $actor);
        }

        return $category;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'categoria';
        $slug = $base;
        $suffix = 2;

        while (Category::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
