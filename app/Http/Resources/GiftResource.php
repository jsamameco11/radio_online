<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\Gift;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A gift of the catalog: "🌹 Rosa · US$ 1.00".
 *
 * @mixin Gift
 */
class GiftResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'emoji' => $this->emoji,
            'image_url' => app(MediaStorage::class)->url($this->image_path),
            'price_cents' => $this->price_cents,
            'animation' => $this->animation,
            'sort_order' => $this->sort_order,
            'active' => $this->active,
        ];
    }
}
