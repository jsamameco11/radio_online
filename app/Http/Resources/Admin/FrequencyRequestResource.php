<?php

namespace App\Http\Resources\Admin;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Http\Resources\FrequencyPaymentResource;
use App\Models\Category;
use App\Models\FrequencyRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A frequency request as reviewers and station teams see it. Eager load
 * "user", "frequency.station", "reviewer" and "station.frequency" (and
 * "payment" to show the price of priced frequencies); attach the
 * requested categories with ::attachCategories().
 *
 * @mixin FrequencyRequest
 */
class FrequencyRequestResource extends JsonResource
{
    /**
     * Sets the "categories" relation of every request from its category_ids, with one query.
     *
     * @param  iterable<FrequencyRequest>  $requests
     */
    public static function attachCategories(iterable $requests): void
    {
        $requests = collect($requests);
        $categories = Category::query()
            ->whereIn('id', $requests->flatMap(fn (FrequencyRequest $request) => $request->category_ids ?? [])->unique()->all())
            ->get()
            ->keyBy('id');

        $requests->each(fn (FrequencyRequest $request) => $request->setRelation(
            'categories',
            collect($request->category_ids ?? [])->map(fn (mixed $id) => $categories->get((int) $id))->filter()->values(),
        ));
    }

    public function toArray(Request $request): array
    {
        $frequencyFree = $this->frequency->status === FrequencyStatus::Available
            || ($this->frequency->status === FrequencyStatus::Reserved && $this->frequency->station === null);

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'user' => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email],
            'frequency' => [
                'label' => $this->frequency->label,
                'slug' => $this->frequency->slug,
                'display' => $this->frequency->display(),
                'status' => $this->frequency->status->value,
                'status_label' => $this->frequency->status->label(),
            ],
            'conflict' => $this->status->isOpen() && ! $frequencyFree,
            'payment' => $this->whenLoaded('payment', fn () => $this->payment === null ? null : FrequencyPaymentResource::make($this->payment)->resolve($request)),
            'station_name' => $this->station_name,
            'pitch' => $this->pitch,
            'categories' => $this->whenLoaded('categories', fn () => $this->getRelation('categories')->map(fn (Category $category) => $category->name)->all(), []),
            'station' => $this->station === null ? null : ['id' => $this->station->id, 'display_name' => $this->station->displayName(), 'slug' => $this->station->frequency->slug],
            'reviewer' => $this->reviewer === null ? null : ['id' => $this->reviewer->id, 'name' => $this->reviewer->name],
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'review_note' => $this->review_note,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
