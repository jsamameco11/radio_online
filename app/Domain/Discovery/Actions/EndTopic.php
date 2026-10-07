<?php

namespace App\Domain\Discovery\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Discovery\Events\CurrentTopicChanged;
use App\Models\CurrentTopic;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Closes the current topic of a station; it stays in the history. */
final class EndTopic
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, User $actor): ?CurrentTopic
    {
        $topic = DB::transaction(function () use ($station) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);
            if ($station->current_topic_id === null) {
                return null;
            }

            $topic = CurrentTopic::acrossStations()->find($station->current_topic_id);
            $topic?->update(['ended_at' => now()]);
            $station->forceFill(['current_topic_id' => null])->save();

            return $topic;
        });

        if ($topic !== null) {
            $this->audit->record('topic.ended', $topic, ['title' => $topic->title], $actor, $station);
            CurrentTopicChanged::dispatch($station->id, null);
        }

        return $topic;
    }
}
