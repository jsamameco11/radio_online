<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Stations\Analytics\LocalTime;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AuditLogResource;
use App\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/** Admin > Auditoría: who did what, on which station and when. */
class AuditLogController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $actor = $request->string('actor')->trim()->limit(80, '')->toString();
        $action = $request->string('action')->trim()->limit(60, '')->toString();
        $station = $request->string('station')->trim()->limit(80, '')->toString();
        $from = $this->date($request->string('from')->toString());
        $to = $this->date($request->string('to')->toString());

        $page = AuditLog::query()
            ->with(['actor', 'station.frequency'])
            ->when($actor !== '', fn (Builder $query) => $query->whereHas('actor', fn (Builder $user) => $user
                ->where('email', 'like', "%{$actor}%")
                ->orWhere('name', 'like', "%{$actor}%")))
            ->when($action !== '', fn (Builder $query) => str_ends_with($action, '.')
                ? $query->where('action', 'like', "{$action}%")
                : $query->where('action', $action))
            ->when($station !== '', fn (Builder $query) => $query->whereHas('station', fn (Builder $stations) => $stations
                ->withTrashed()
                ->where(fn (Builder $search) => $search
                    ->where('name', 'like', "%{$station}%")
                    ->orWhereHas('frequency', fn (Builder $frequency) => $frequency->where('label', 'like', str_replace(',', '.', $station).'%')))))
            ->when($from, fn (Builder $query, CarbonImmutable $from) => $query->where('created_at', '>=', $from))
            ->when($to, fn (Builder $query, CarbonImmutable $to) => $query->where('created_at', '<', $to->addDay()))
            ->latest('created_at')
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request));

        $actions = AuditLog::query()->distinct()->orderBy('action')->pluck('action');

        return Inertia::render('Admin/Audit/Index', [
            'logs' => $page,
            'filters' => [
                'actor' => $actor,
                'action' => $action,
                'station' => $station,
                'from' => $from?->setTimezone(LocalTime::timezone())->toDateString() ?? '',
                'to' => $to?->setTimezone(LocalTime::timezone())->toDateString() ?? '',
            ],
            'actions' => $actions->all(),
            'areas' => $actions->map(fn (string $item) => explode('.', $item)[0].'.')->unique()->values()->all(),
        ]);
    }

    /** Start of a local day (platform timezone) as UTC, or null when the input is not a date. */
    private function date(string $value): ?CarbonImmutable
    {
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        try {
            return CarbonImmutable::createFromFormat('Y-m-d', $value, LocalTime::timezone())->startOfDay()->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
