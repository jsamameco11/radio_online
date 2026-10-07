<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Discovery\Hashtags;
use App\Domain\Stations\Support\StationPreferences;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Saves the public profile of a station: tagline, description, look, language, country, up to
 * three categories in order, its permanent hashtags and social links.
 */
final class UpdateStationProfile
{
    public function __construct(
        private readonly StationPreferences $preferences,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array{tagline: ?string, description: ?string, accent_color: ?string, language: string, country: ?string, categories: list<int>, hashtags: list<string>, links: array<string, ?string>}  $profile
     */
    public function handle(Station $station, array $profile, User $actor): Station
    {
        $changed = DB::transaction(function () use ($station, $profile) {
            $station->fill([
                'tagline' => $profile['tagline'],
                'description' => $profile['description'],
                'accent_color' => $profile['accent_color'],
                'language' => $profile['language'],
                'country' => $profile['country'],
            ]);
            $changed = array_keys($station->getDirty());
            $station->save();

            $categories = $station->categories()->sync(
                collect($profile['categories'])
                    ->unique()
                    ->take((int) config('platform.stations.max_categories'))
                    ->values()
                    ->mapWithKeys(fn (int $id, int $position) => [$id => ['position' => $position]])
                    ->all(),
            );
            if (array_filter($categories)) {
                $changed[] = 'categories';
            }

            $before = $station->hashtags()->pluck('hashtags.slug')->all();
            $after = Hashtags::sync($station->hashtags(), $profile['hashtags'], (int) config('platform.stations.max_permanent_hashtags'))->pluck('slug')->all();
            if ($before !== $after) {
                $changed[] = 'hashtags';
            }

            if ($this->preferences->put($station, 'profile', $profile['links']) !== []) {
                $changed[] = 'links';
            }

            return $changed;
        });

        if ($changed !== []) {
            $this->audit->record('station.profile_updated', $station, ['fields' => $changed], $actor);
        }

        return $station;
    }
}
