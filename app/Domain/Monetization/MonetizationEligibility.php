<?php

namespace App\Domain\Monetization;

use App\Domain\Growth\StationActivity;
use App\Domain\Monetization\Support\Eligibility;
use App\Domain\Stations\Analytics\LocalTime;
use App\Models\Station;
use Carbon\CarbonImmutable;

/** Reads a station's subscribers and live audience against config('platform.monetization'). */
final class MonetizationEligibility
{
    /** Days of live peaks shown along the journey. */
    public const RECENT_DAYS = 14;

    public function __construct(private readonly StationActivity $activity) {}

    public function evaluate(Station $station): Eligibility
    {
        $threshold = (int) config('platform.monetization.live_listeners');

        return Eligibility::evaluate(
            subscribers: $station->follower_count,
            qualifyingPeaks: $this->activity->dailyPeaks($station, CarbonImmutable::createFromTimestamp(0), $threshold),
            recentPeaks: $this->activity->dailyPeaks($station, LocalTime::startOfDay(self::RECENT_DAYS - 1)),
            today: CarbonImmutable::now(LocalTime::timezone())->toDateString(),
            recentDays: self::RECENT_DAYS,
            minSubscribers: (int) config('platform.monetization.min_subscribers'),
            threshold: $threshold,
            requiredDays: (int) config('platform.monetization.live_days'),
        );
    }
}
