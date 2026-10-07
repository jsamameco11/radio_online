<?php

namespace App\Domain\Discovery\Actions;

use App\Models\Category;
use Illuminate\Support\Facades\DB;

/** Moves a category one place up or down inside its group, renumbering the group. */
final class MoveCategory
{
    public function handle(Category $category, bool $up): void
    {
        DB::transaction(function () use ($category, $up) {
            $siblings = Category::query()
                ->where('group', $category->group->value)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->lockForUpdate()
                ->get()
                ->values();

            $index = $siblings->search(fn (Category $sibling) => $sibling->is($category));
            $swap = $up ? $index - 1 : $index + 1;

            if ($index === false || $swap < 0 || $swap >= $siblings->count()) {
                return;
            }

            $ordered = $siblings->all();
            [$ordered[$index], $ordered[$swap]] = [$ordered[$swap], $ordered[$index]];

            foreach ($ordered as $position => $sibling) {
                if ($sibling->sort_order !== $position) {
                    $sibling->forceFill(['sort_order' => $position])->save();
                }
            }
        });
    }
}
