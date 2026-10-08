<?php

namespace App\Domain\Integrity;

use App\Domain\Integrity\Enums\AlertKind;
use App\Domain\Integrity\Enums\AlertSeverity;
use App\Domain\Integrity\Enums\AlertStatus;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\IntegrityAlert;
use App\Models\ListenerSession;
use App\Models\Station;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Looks at the last config('platform.integrity.scan.window_hours') of every station for the
 * footprints of bot farms and files an alert per station and pattern for the staff (Admin >
 * Integridad): many subscriptions from one network, a wave of freshly created accounts, a
 * spike of subscribers who never listened, a swarm of players from one network and players
 * already blocked. An open alert is refreshed (its accounts accumulate) instead of repeated,
 * and what the staff already resolved is not raised again.
 */
final class IntegrityScanner
{
    /** Accounts kept as evidence per alert. */
    private const MAX_ACCOUNTS = 2000;

    /** Networks kept as evidence per alert. */
    private const MAX_NETWORKS = 200;

    /** @return int alerts filed or refreshed */
    public function scan(): int
    {
        $now = CarbonImmutable::now();
        $since = $now->subHours((int) config('platform.integrity.scan.window_hours', 24));

        $open = IntegrityAlert::query()->where('status', AlertStatus::Open->value)->get()
            ->keyBy(fn (IntegrityAlert $alert) => $alert->station_id.':'.$alert->kind->value);
        $resolved = IntegrityAlert::query()->toBase()
            ->where('status', '!=', AlertStatus::Open->value)
            ->where('resolved_at', '>=', $since)
            ->selectRaw('station_id, kind, max(resolved_at) as resolved_at')
            ->groupBy('station_id', 'kind')
            ->get()
            ->keyBy(fn (object $row) => $row->station_id.':'.$row->kind);

        $filed = 0;
        Station::query()->where('status', StationStatus::Active->value)->select('id')->chunkById(200, function (Collection $stations) use ($since, $now, $open, $resolved, &$filed) {
            foreach ($stations as $station) {
                foreach (AlertKind::cases() as $kind) {
                    $key = $station->id.':'.$kind->value;
                    $from = isset($resolved[$key]) ? CarbonImmutable::parse($resolved[$key]->resolved_at)->max($since) : $since;
                    $finding = $this->detect($kind, $station->id, $from, $now);
                    if ($finding !== null) {
                        $this->file($open->get($key), $station->id, $kind, $finding, $from, $now);
                        $filed++;
                    }
                }
            }
        });

        return $filed;
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function detect(AlertKind $kind, int $stationId, CarbonImmutable $from, CarbonImmutable $now): ?array
    {
        return match ($kind) {
            AlertKind::FollowCluster => $this->followCluster($stationId, $from),
            AlertKind::FreshAccountWave => $this->freshAccountWave($stationId, $from),
            AlertKind::FollowSpike => $this->followSpike($stationId, $from, $now),
            AlertKind::AudienceSwarm => $this->audienceSwarm($stationId, $from),
            AlertKind::BlockedPlayers => $this->blockedPlayers($stationId, $from),
        };
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function followCluster(int $stationId, CarbonImmutable $from): ?array
    {
        $minimum = (int) config('platform.integrity.scan.cluster_follows');
        $clusters = $this->follows($stationId, $from)
            ->whereNotNull('network')
            ->selectRaw('network, count(*) as total')
            ->groupBy('network')
            ->havingRaw('count(*) >= ?', [$minimum])
            ->pluck('total', 'network')
            ->map(fn (mixed $total) => (int) $total);
        if ($clusters->isEmpty()) {
            return null;
        }
        $largest = (int) $clusters->max();

        return [
            'severity' => $largest >= $minimum * 3 ? AlertSeverity::High : AlertSeverity::Medium,
            'evidence' => [
                'follows' => (int) $clusters->sum(),
                'network_count' => $clusters->count(),
                'largest' => $largest,
                'user_ids' => $this->follows($stationId, $from)->whereIn('network', $clusters->keys()->all())
                    ->limit(self::MAX_ACCOUNTS)->pluck('user_id')->map(fn (mixed $id) => (int) $id)->all(),
            ],
        ];
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function freshAccountWave(int $stationId, CarbonImmutable $from): ?array
    {
        $total = $this->follows($stationId, $from)->count();
        if ($total < (int) config('platform.integrity.scan.wave_follows')) {
            return null;
        }
        $fresh = $this->follows($stationId, $from)
            ->join('users', 'users.id', '=', 'follows.user_id')
            ->where('users.created_at', '>=', $from->subDays((int) config('platform.integrity.scan.fresh_account_days')))
            ->limit(self::MAX_ACCOUNTS)
            ->pluck('follows.user_id')
            ->map(fn (mixed $id) => (int) $id);
        $share = (int) round($fresh->count() * 100 / $total);
        if ($share < (int) config('platform.integrity.scan.wave_share_percent')) {
            return null;
        }

        return [
            'severity' => $share >= 85 ? AlertSeverity::High : AlertSeverity::Medium,
            'evidence' => ['follows' => $total, 'fresh' => $fresh->count(), 'share' => $share, 'user_ids' => $fresh->all()],
        ];
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function followSpike(int $stationId, CarbonImmutable $from, CarbonImmutable $now): ?array
    {
        $recent = $this->follows($stationId, $from)->count();
        $hours = max(1, $from->diffInHours($now, true));
        $baseline = DB::table('follows')->where('station_id', $stationId)
            ->where('created_at', '>=', $from->subDays(14))->where('created_at', '<', $from)
            ->count() / (14 * 24) * $hours;
        if ($recent < max((int) config('platform.integrity.scan.spike_follows'), (int) ceil((int) config('platform.integrity.scan.spike_factor') * $baseline))) {
            return null;
        }

        $followers = $this->follows($stationId, $from)->limit(self::MAX_ACCOUNTS)->pluck('user_id')->map(fn (mixed $id) => (int) $id);
        $listeners = ListenerSession::query()->toBase()
            ->where('station_id', $stationId)
            ->whereIn('user_id', $followers->all())
            ->where('suspect', false)
            ->groupBy('user_id')
            ->havingRaw('sum(seconds) >= ?', [Subscribers::listenSeconds()])
            ->pluck('user_id')
            ->map(fn (mixed $id) => (int) $id);
        $silent = $followers->diff($listeners)->values();
        if ($silent->isEmpty()) {
            return null;
        }
        $share = (int) round($silent->count() * 100 / max(1, $followers->count()));

        return [
            'severity' => $share >= 80 ? AlertSeverity::High : AlertSeverity::Medium,
            'evidence' => ['follows' => $recent, 'baseline' => round($baseline, 1), 'silent' => $silent->count(), 'share' => $share, 'user_ids' => $silent->all()],
        ];
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function audienceSwarm(int $stationId, CarbonImmutable $from): ?array
    {
        $minimum = (int) config('platform.integrity.scan.swarm_sessions');
        $swarms = ListenerSession::query()->toBase()
            ->where('station_id', $stationId)
            ->where('started_at', '>=', $from)
            ->whereNotNull('network')
            ->selectRaw('network, count(*) as total')
            ->groupBy('network')
            ->havingRaw('count(*) >= ?', [$minimum])
            ->orderByDesc('total')
            ->limit(self::MAX_NETWORKS)
            ->pluck('total', 'network')
            ->map(fn (mixed $total) => (int) $total);
        if ($swarms->isEmpty()) {
            return null;
        }
        $largest = (int) $swarms->max();

        return [
            'severity' => $largest >= $minimum * 3 ? AlertSeverity::High : AlertSeverity::Medium,
            'evidence' => ['sessions' => (int) $swarms->sum(), 'network_count' => $swarms->count(), 'largest' => $largest, 'networks' => $swarms->keys()->all()],
        ];
    }

    /** @return array{severity: AlertSeverity, evidence: array<string, mixed>}|null */
    private function blockedPlayers(int $stationId, CarbonImmutable $from): ?array
    {
        $blocked = ListenerSession::query()->where('station_id', $stationId)->where('started_at', '>=', $from)->where('suspect', true)->count();
        if ($blocked < (int) config('platform.integrity.scan.automated_sessions')) {
            return null;
        }

        return ['severity' => AlertSeverity::Low, 'evidence' => ['sessions' => $blocked]];
    }

    /** The subscriptions of a station since $from that were not discarded yet. */
    private function follows(int $stationId, CarbonImmutable $from): Builder
    {
        return DB::table('follows')
            ->where('follows.station_id', $stationId)
            ->where('follows.created_at', '>=', $from)
            ->where('follows.status', '!=', FollowStatus::Discarded->value);
    }

    /** @param  array{severity: AlertSeverity, evidence: array<string, mixed>}  $finding */
    private function file(?IntegrityAlert $alert, int $stationId, AlertKind $kind, array $finding, CarbonImmutable $from, CarbonImmutable $now): void
    {
        $evidence = $finding['evidence'];
        if ($alert === null) {
            IntegrityAlert::query()->create([
                'station_id' => $stationId,
                'kind' => $kind,
                'severity' => $finding['severity'],
                'evidence' => ['since' => $from->toIso8601String(), ...$evidence],
                'detected_at' => $now,
                'last_detected_at' => $now,
            ]);

            return;
        }

        $previous = $alert->evidence;
        foreach (['user_ids' => self::MAX_ACCOUNTS, 'networks' => self::MAX_NETWORKS] as $list => $max) {
            if (isset($evidence[$list])) {
                $evidence[$list] = array_slice(array_values(array_unique([...($previous[$list] ?? []), ...$evidence[$list]])), 0, $max);
            }
        }
        $alert->forceFill([
            'severity' => $alert->severity->max($finding['severity']),
            'evidence' => ['since' => $previous['since'] ?? $from->toIso8601String(), ...$evidence],
            'last_detected_at' => $now,
        ])->save();
    }
}
