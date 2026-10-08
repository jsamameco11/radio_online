<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Track;
use Illuminate\Support\Facades\DB;

/**
 * «Música continua»: the given songs repeat in the automatic music and every other active song
 * of the station stops repeating. Inactive songs keep their mark untouched.
 */
final class ChooseRotation
{
    public function __construct(private readonly PlayoutCaches $caches) {}

    /**
     * @param  list<string>  $ids
     * @return int songs that repeat after the change
     */
    public function handle(array $ids): int
    {
        $songs = fn () => Track::query()->where('kind', TrackKind::Song->value)->where('active', true);

        DB::transaction(function () use ($songs, $ids) {
            $songs()->whereKey($ids)->update(['rotation' => true]);
            $songs()->whereKeyNot($ids)->update(['rotation' => false]);
        });
        $this->caches->flush();

        return $songs()->where('rotation', true)->count();
    }
}
