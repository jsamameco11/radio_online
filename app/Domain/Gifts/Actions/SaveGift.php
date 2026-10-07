<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\Gift;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Creates or edits a gift of the catalog. Gifts already sent keep the price
 * they were sent at: each gift transaction stores its own unit price.
 */
final class SaveGift
{
    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @param  array{name: string, emoji: string, price_cents: int, animation: string|null, sort_order: int, active: bool}  $data
     */
    public function handle(?Gift $gift, array $data, User $actor): Gift
    {
        $creating = $gift === null;
        $gift ??= new Gift(['slug' => $this->uniqueSlug($data['name'])]);
        $before = $gift->only(['name', 'emoji', 'price_cents', 'animation', 'sort_order', 'active']);

        $gift->fill($data)->save();

        $this->audit->record($creating ? 'gift.created' : 'gift.updated', $gift, [
            'before' => $creating ? null : $before,
            'after' => $gift->only(['name', 'emoji', 'price_cents', 'animation', 'sort_order', 'active']),
        ], $actor);

        return $gift;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'regalo';
        $slug = $base;

        for ($suffix = 2; Gift::query()->where('slug', $slug)->exists(); $suffix++) {
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }
}
