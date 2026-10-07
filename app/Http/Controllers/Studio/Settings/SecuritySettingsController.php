<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Actions\CloseStation;
use App\Domain\Stations\Actions\TransferStationOwnership;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationPreferences;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\CloseStationRequest;
use App\Http\Requests\Stations\TransferOwnershipRequest;
use App\Http\Requests\Stations\UpdateSecuritySettingsRequest;
use App\Models\StationMember;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Configuración > Seguridad: team 2FA, open sessions and the danger zone. */
class SecuritySettingsController extends Controller
{
    public function __construct(
        private readonly CurrentStation $current,
        private readonly StationPreferences $preferences,
    ) {}

    public function show(Request $request): Response
    {
        $station = $this->current->get()->loadMissing('frequency');
        $user = $request->user();
        $members = StationMember::query()->where('station_id', $station->id)->with('user')->get();
        $sessions = $this->sessions($members->pluck('user_id'));
        $isOwner = $user->id === $station->owner_id;

        return Inertia::render('Studio/Settings/Security', [
            'settings' => $this->preferences->get($station, 'security'),
            'team' => $members
                ->map(fn (StationMember $member) => [
                    'id' => $member->id,
                    'user_id' => $member->user_id,
                    'name' => $member->user->name,
                    'email' => $member->user->email,
                    'role' => $member->role->value,
                    'role_label' => $member->role->label(),
                    'two_factor_enabled' => $member->user->hasTwoFactorEnabled(),
                    'last_login_at' => $member->user->last_login_at?->toIso8601String(),
                    'sessions' => (int) ($sessions[$member->user_id]['total'] ?? 0),
                    'last_seen_at' => $sessions[$member->user_id]['last_seen_at'] ?? null,
                ])
                ->sortBy(fn (array $member) => $member['role'] === StationRole::Owner->value ? 0 : 1)
                ->values()
                ->all(),
            'tracksSessions' => config('session.driver') === 'database',
            'userHasTwoFactor' => $user->hasTwoFactorEnabled(),
            'canManage' => $user->canInStation($station, StationPermission::ManageMembers),
            'isOwner' => $isOwner,
            'frequencyLabel' => $station->frequency->label,
            'transferCandidates' => $isOwner
                ? $members
                    ->reject(fn (StationMember $member) => $member->role === StationRole::Owner)
                    ->map(fn (StationMember $member) => ['value' => $member->user_id, 'label' => "{$member->user->name} · {$member->role->label()}"])
                    ->values()
                    ->all()
                : [],
        ]);
    }

    public function update(UpdateSecuritySettingsRequest $request, AuditTrail $audit): RedirectResponse
    {
        $station = $this->current->get();
        $required = $request->boolean('require_two_factor');

        if ($this->preferences->put($station, 'security', ['require_two_factor' => $required]) !== []) {
            $audit->record('station.settings_updated', $station, ['group' => 'security', 'fields' => ['require_two_factor'], 'require_two_factor' => $required], $request->user());
        }

        return back()->with('success', $required
            ? 'Desde ahora todo el equipo necesita la verificación en dos pasos para entrar al estudio.'
            : 'La verificación en dos pasos ya no es obligatoria para el equipo.');
    }

    public function transfer(TransferOwnershipRequest $request, TransferStationOwnership $transfer): RedirectResponse
    {
        $transfer->handle($this->current->get(), (int) $request->validated('user_id'), $request->user());

        return back()->with('success', 'Transferiste la emisora. Ahora eres administrador de radio.');
    }

    public function close(CloseStationRequest $request, CloseStation $close): RedirectResponse
    {
        $station = $this->current->get();
        $name = $station->displayName();
        $close->handle($station, $request->user());

        return redirect()->route('studio.home')->with('success', "Cerraste {$name}. La frecuencia quedó reservada.");
    }

    /**
     * Open sessions per user, when sessions live in the database.
     *
     * @param  Collection<int, int>  $userIds
     * @return array<int, array{total: int, last_seen_at: string}>
     */
    private function sessions(Collection $userIds): array
    {
        if (config('session.driver') !== 'database' || $userIds->isEmpty()) {
            return [];
        }

        return DB::table((string) config('session.table', 'sessions'))
            ->whereIn('user_id', $userIds->all())
            ->where('last_activity', '>=', now()->subMinutes((int) config('session.lifetime'))->getTimestamp())
            ->groupBy('user_id')
            ->selectRaw('user_id, count(*) as total, max(last_activity) as last_activity')
            ->get()
            ->mapWithKeys(fn (object $row) => [(int) $row->user_id => [
                'total' => (int) $row->total,
                'last_seen_at' => CarbonImmutable::createFromTimestamp((int) $row->last_activity)->toIso8601String(),
            ]])
            ->all();
    }
}
