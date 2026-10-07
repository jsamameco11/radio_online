<?php

namespace App\Domain\Access;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The browsers where an account is signed in, as the security page lists
 * them. Only the database session driver keeps that list; with any other
 * driver just the current browser is known.
 */
final class AccountSessions
{
    /**
     * @return list<array{id: string, browser: string, platform: string, mobile: bool, ip_address: string|null, last_active_at: string, current: bool}>
     */
    public function of(User $user, string $currentSessionId, ?string $currentIp, ?string $currentAgent): array
    {
        if (config('session.driver') !== 'database') {
            return [$this->present(hash('sha256', $currentSessionId), $currentAgent, $currentIp, now()->timestamp, true)];
        }

        return DB::connection(config('session.connection'))
            ->table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->limit(20)
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn (object $session) => $this->present(
                hash('sha256', (string) $session->id),
                $session->user_agent,
                $session->ip_address,
                (int) $session->last_activity,
                $session->id === $currentSessionId,
            ))
            ->values()
            ->all();
    }

    /**
     * @return array{id: string, browser: string, platform: string, mobile: bool, ip_address: string|null, last_active_at: string, current: bool}
     */
    private function present(string $id, ?string $agent, ?string $ip, int $lastActivity, bool $current): array
    {
        $agent ??= '';

        return [
            'id' => substr($id, 0, 16),
            'browser' => $this->browser($agent),
            'platform' => $this->platform($agent),
            'mobile' => (bool) preg_match('/Mobile|Android|iPhone|iPad/i', $agent),
            'ip_address' => $ip,
            'last_active_at' => Carbon::createFromTimestamp($lastActivity)->toIso8601String(),
            'current' => $current,
        ];
    }

    private function browser(string $agent): string
    {
        return match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') => 'Opera',
            str_contains($agent, 'Firefox/') => 'Firefox',
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => 'Navegador desconocido',
        };
    }

    private function platform(string $agent): string
    {
        return match (true) {
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Android') => 'Android',
            (bool) preg_match('/iPhone|iPad/', $agent) => 'iOS',
            str_contains($agent, 'Mac OS') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'Sistema desconocido',
        };
    }
}
