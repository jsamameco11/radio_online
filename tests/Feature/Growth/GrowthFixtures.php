<?php

namespace Tests\Feature\Growth;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Episode;
use App\Models\Station;
use App\Models\StreamSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Studio\LibraryFixtures;

/** Live broadcasts, episodes, subscribers and earnings for the growth and monetization tests. */
trait GrowthFixtures
{
    use LibraryFixtures;

    /** A moment in the platform timezone: "2026-10-07 10:00". */
    protected function lima(string $moment): CarbonImmutable
    {
        return CarbonImmutable::parse($moment, (string) config('platform.timezone'));
    }

    protected function liveSession(Station $station, CarbonImmutable $startedAt, int $peak = 5): StreamSession
    {
        return StreamSession::query()->create([
            'station_id' => $station->id,
            'source' => 'browser',
            'started_at' => $startedAt->utc(),
            'ended_at' => $startedAt->utc()->addHour(),
            'peak_listeners' => $peak,
        ]);
    }

    protected function publishedEpisode(Station $station, CarbonImmutable $publishedAt): Episode
    {
        $track = $this->storedTrack($station);

        return app(CurrentStation::class)->within($station, fn () => Episode::query()->create([
            'track_id' => $track->id,
            'title' => 'Programa '.Str::random(4),
            'status' => EpisodeStatus::Published,
            'aired_on' => $publishedAt->toDateString(),
            'published_at' => $publishedAt->utc(),
        ]));
    }

    /** Subscribers and three consecutive days over the live audience threshold, ending yesterday. */
    protected function makeEligible(Station $station): void
    {
        $station->forceFill(['follower_count' => (int) config('platform.monetization.min_subscribers')])->save();
        $peak = (int) config('platform.monetization.live_listeners');

        foreach ([3, 2, 1] as $daysAgo) {
            $this->liveSession($station, CarbonImmutable::now(config('platform.timezone'))->subDays($daysAgo)->setTime(20, 0), $peak);
        }
    }

    protected function creditStation(Station $station, int $cents): void
    {
        $ledger = app(WalletLedger::class);
        $ledger->credit($ledger->open($station), WalletTransactionType::GiftEarning, $cents, new LedgerEntry('seed:'.Str::uuid()));
    }
}
