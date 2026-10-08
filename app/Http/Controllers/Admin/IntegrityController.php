<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Integrity\Actions\ResolveIntegrityAlert;
use App\Domain\Integrity\Enums\AlertSeverity;
use App\Domain\Integrity\Enums\AlertStatus;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Integrity\Subscribers;
use App\Domain\Stations\Analytics\LocalTime;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResolveIntegrityAlertRequest;
use App\Http\Resources\Admin\IntegrityAlertResource;
use App\Models\IntegrityAlert;
use App\Models\ListenerSession;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Integridad: the bot-farm alerts of every station and how the figures are protected. */
class IntegrityController extends Controller
{
    /** Accounts listed per alert. */
    private const ACCOUNTS = 200;

    public function index(Request $request): Response
    {
        $tab = AlertStatus::tryFrom($request->string('tab')->toString()) ?? AlertStatus::Open;
        $open = $tab === AlertStatus::Open;

        $page = IntegrityAlert::query()
            ->with(['station.frequency', 'resolver'])
            ->where('status', $tab->value)
            ->when($open, fn ($query) => $query
                ->orderByRaw('case severity when ? then 0 when ? then 1 else 2 end', [AlertSeverity::High->value, AlertSeverity::Medium->value])
                ->orderByDesc('last_detected_at'))
            ->when(! $open, fn ($query) => $query->orderByDesc('resolved_at'))
            ->paginate(20)
            ->withQueryString()
            ->through(fn (IntegrityAlert $alert) => IntegrityAlertResource::make($alert)->resolve($request));

        $counts = IntegrityAlert::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $follows = DB::table('follows')->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('Admin/Integrity/Index', [
            'alerts' => $page,
            'tab' => $tab->value,
            'counts' => collect(AlertStatus::cases())->mapWithKeys(fn (AlertStatus $status) => [$status->value => (int) ($counts[$status->value] ?? 0)])->all(),
            'stats' => [
                'pending_follows' => (int) ($follows[FollowStatus::Pending->value] ?? 0),
                'discarded_follows' => (int) ($follows[FollowStatus::Discarded->value] ?? 0),
                'flagged_accounts' => User::query()->whereNotNull('flagged_at')->count(),
                'blocked_today' => ListenerSession::query()->where('suspect', true)->where('started_at', '>=', LocalTime::startOfDay(0))->count(),
            ],
            'rules' => [
                'account_hours' => Subscribers::accountHours(),
                'listen_seconds' => Subscribers::listenSeconds(),
                'guests_per_network' => (int) config('platform.integrity.guests_per_network'),
                'warmup_seconds' => (int) config('platform.integrity.warmup_seconds'),
                'follows_per_hour' => (int) config('platform.integrity.follows_per_hour'),
                'follows_per_day' => (int) config('platform.integrity.follows_per_day'),
            ],
            'canFlag' => $request->user()->can(Permission::ManageUsers->value),
        ]);
    }

    /** The accounts behind a subscription alert, newest first. */
    public function accounts(IntegrityAlert $alert): JsonResponse
    {
        $ids = $alert->userIds();
        $users = User::query()->whereIn('id', $ids)->latest()->limit(self::ACCOUNTS)->get(['id', 'name', 'email', 'created_at', 'email_verified_at', 'flagged_at', 'status']);
        $listened = ListenerSession::query()->toBase()
            ->whereIn('user_id', $users->modelKeys())
            ->where('suspect', false)
            ->selectRaw('user_id, coalesce(sum(seconds), 0) as seconds')
            ->groupBy('user_id')
            ->pluck('seconds', 'user_id');
        $follows = DB::table('follows')->where('station_id', $alert->station_id)->whereIn('user_id', $users->modelKeys())->pluck('status', 'user_id');

        return response()->json([
            'total' => count($ids),
            'accounts' => $users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at?->toIso8601String(),
                'verified' => $user->email_verified_at !== null,
                'flagged' => $user->isFlagged(),
                'suspended' => $user->isSuspended(),
                'listened_minutes' => (int) floor((int) ($listened[$user->id] ?? 0) / 60),
                'follow' => ($status = FollowStatus::tryFrom((string) ($follows[$user->id] ?? ''))) === null ? null : ['value' => $status->value, 'label' => $status->label()],
            ])->values()->all(),
        ]);
    }

    public function resolve(ResolveIntegrityAlertRequest $request, IntegrityAlert $alert, ResolveIntegrityAlert $resolve): RedirectResponse
    {
        $outcome = $request->outcome();
        if ($outcome === AlertStatus::Purged && $alert->kind->concernsAccounts() && ! $request->user()->can(Permission::ManageUsers->value)) {
            abort(403);
        }
        $affected = $resolve->handle($alert, $outcome, $request->note(), $request->user());

        return back()->with('success', match (true) {
            $outcome === AlertStatus::Dismissed => 'Alerta descartada: no se tocó ninguna cifra.',
            $alert->kind->concernsAccounts() => $affected === 1 ? 'Depurada: marcamos 1 cuenta y sus suscripciones dejaron de contar.' : "Depurada: marcamos {$affected} cuentas y sus suscripciones dejaron de contar.",
            default => "Depurada: {$affected} reproducciones salieron de las estadísticas.",
        });
    }
}
