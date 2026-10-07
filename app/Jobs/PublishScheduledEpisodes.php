<?php

namespace App\Jobs;

use App\Domain\Studio\Enums\EpisodeStatus;
use App\Models\Episode;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Publishes, in every station, the scheduled episodes whose moment has come. */
class PublishScheduledEpisodes implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 300;

    public function handle(): void
    {
        Episode::acrossStations()
            ->where('status', EpisodeStatus::Scheduled->value)
            ->where('publish_at', '<=', now())
            ->chunkById(200, function ($episodes) {
                foreach ($episodes as $episode) {
                    $episode->forceFill([
                        'status' => EpisodeStatus::Published,
                        'published_at' => $episode->publish_at,
                        'publish_at' => null,
                    ])->save();
                }
            });
    }
}
