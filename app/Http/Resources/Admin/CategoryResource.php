<?php

namespace App\Http\Resources\Admin;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A station category in the control panel. Counts "stations" when loaded.
 *
 * @mixin Category
 */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'group' => $this->group->value,
            'group_label' => $this->group->label(),
            'sort_order' => $this->sort_order,
            'active' => $this->active,
            'stations_count' => $this->whenCounted('stations'),
        ];
    }
}
