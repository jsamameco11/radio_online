<?php

namespace App\Domain\Discovery\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Discovery\Events\CurrentTopicChanged;
use App\Domain\Discovery\Hashtags;
use App\Models\CurrentTopic;
use App\Models\Hashtag;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Sets "what is happening now" on a station. A new topic closes the current
 * one so it stays in the history; editing keeps the same topic and only
 * replaces its title and temporary hashtags.
 */
final class PublishTopic
{
    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @param  list<string>  $hashtags
     */
    public function handle(Station $station, User $author, string $title, array $hashtags, bool $editCurrent = false): CurrentTopic
    {
        $topic = DB::transaction(function () use ($station, $author, $title, $hashtags, $editCurrent) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);
            $current = $station->current_topic_id === null ? null : CurrentTopic::acrossStations()->find($station->current_topic_id);

            if ($editCurrent && $current !== null) {
                $current->update(['title' => $title]);
                $topic = $current;
            } else {
                $current?->update(['ended_at' => now()]);
                $topic = CurrentTopic::acrossStations()->create([
                    'station_id' => $station->id,
                    'title' => $title,
                    'created_by' => $author->id,
                    'started_at' => now(),
                ]);
                $station->forceFill(['current_topic_id' => $topic->id])->save();
            }

            Hashtags::sync($topic->hashtags(), $hashtags, (int) config('platform.stations.max_topic_hashtags'));

            return $topic->load('hashtags');
        });

        $this->audit->record($editCurrent ? 'topic.updated' : 'topic.started', $topic, [
            'title' => $topic->title,
            'hashtags' => $topic->hashtags->pluck('name')->all(),
        ], $author, $station);

        CurrentTopicChanged::dispatch($station->id, self::payload($topic));

        return $topic;
    }

    /**
     * @return array{id: int, title: string, hashtags: list<string>, started_at: string}
     */
    public static function payload(CurrentTopic $topic): array
    {
        return [
            'id' => $topic->id,
            'title' => $topic->title,
            'hashtags' => $topic->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all(),
            'started_at' => $topic->started_at->toIso8601String(),
        ];
    }
}
