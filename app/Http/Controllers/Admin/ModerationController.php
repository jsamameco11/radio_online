<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Moderation\Actions\HideGiftMessage;
use App\Domain\Moderation\Actions\ResolveReport;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Domain\Stations\Actions\SuspendStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ResolveReportRequest;
use App\Http\Requests\Admin\SuspensionRequest;
use App\Http\Resources\Admin\ReportResource;
use App\Models\ChatMessage;
use App\Models\Episode;
use App\Models\GiftMessage;
use App\Models\Report;
use App\Models\Station;
use App\Models\StationStory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Moderación: the reports queue and the quick actions on reported content. */
class ModerationController extends Controller
{
    /** What ReportResource reads from each kind of reported content. */
    public const REPORTABLE_RELATIONS = [
        Station::class => ['frequency'],
        Episode::class => ['station.frequency'],
        GiftMessage::class => ['giftTransaction.sender', 'giftTransaction.station.frequency'],
        ChatMessage::class => ['user', 'station.frequency'],
        StationStory::class => ['station.frequency'],
    ];

    private const TABS = [
        'open' => [ReportStatus::Open, ReportStatus::Reviewing],
        'resolved' => [ReportStatus::Resolved],
        'dismissed' => [ReportStatus::Dismissed],
    ];

    private const TYPES = ['station', 'episode', 'gift_message', 'chat_message', 'station_story'];

    public function index(Request $request): Response
    {
        $tab = array_key_exists($request->string('tab')->toString(), self::TABS) ? $request->string('tab')->toString() : 'open';
        $type = in_array($request->string('type')->toString(), self::TYPES, true) ? $request->string('type')->toString() : '';

        $page = self::withReportable(Report::query())
            ->whereIn('status', array_map(fn (ReportStatus $status) => $status->value, self::TABS[$tab]))
            ->when($type !== '', fn (Builder $query) => $query->where('reportable_type', $type))
            ->orderBy($tab === 'open' ? 'created_at' : 'resolved_at', $tab === 'open' ? 'asc' : 'desc')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Report $report) => ReportResource::make($report)->resolve($request));

        $counts = Report::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('Admin/Moderation/Index', [
            'reports' => $page,
            'tab' => $tab,
            'type' => $type,
            'counts' => collect(self::TABS)
                ->map(fn (array $statuses) => (int) collect($statuses)->sum(fn (ReportStatus $status) => $counts[$status->value] ?? 0))
                ->all(),
            'types' => [
                ['value' => 'station', 'label' => 'Emisoras'],
                ['value' => 'episode', 'label' => 'Episodios'],
                ['value' => 'gift_message', 'label' => 'Mensajes de regalo'],
                ['value' => 'chat_message', 'label' => 'Mensajes del chat'],
                ['value' => 'station_story', 'label' => 'Estados'],
            ],
        ]);
    }

    public function resolve(ResolveReportRequest $request, Report $report, ResolveReport $resolve): RedirectResponse
    {
        $closed = $resolve->handle($report, $request->outcome(), $request->validated('note'), $request->user());

        $verb = $request->outcome() === ReportStatus::Resolved ? 'resueltos' : 'descartados';

        return back()->with('success', $closed === 1 ? 'Reporte cerrado.' : "{$closed} reportes {$verb}.");
    }

    public function suspendStation(SuspensionRequest $request, Report $report, SuspendStation $suspend, ResolveReport $resolve): RedirectResponse
    {
        $station = $this->reportedStation($report);
        $reason = (string) $request->validated('reason');

        $suspend->handle($station, $reason, $request->user());
        if (in_array($report->status, self::TABS['open'], true)) {
            $resolve->handle($report, ReportStatus::Resolved, "Emisora suspendida: {$reason}", $request->user());
        }

        return back()->with('success', "Suspendiste {$station->name} y cerramos los reportes.");
    }

    public function hideMessage(Request $request, Report $report, HideGiftMessage $hide, ResolveReport $resolve): RedirectResponse
    {
        $message = $this->loadReportable($report)->reportable;
        if (! $message instanceof GiftMessage) {
            throw ValidationException::withMessages(['report' => 'Este reporte no es de un mensaje de regalo.']);
        }

        $hide->handle($message, 'Reporte de moderación', $request->user());
        if (in_array($report->status, self::TABS['open'], true)) {
            $resolve->handle($report, ReportStatus::Resolved, 'Mensaje ocultado.', $request->user());
        }

        return back()->with('success', 'Ocultamos el mensaje y cerramos los reportes.');
    }

    /**
     * @param  Builder<Report>  $query
     * @return Builder<Report>
     */
    private static function withReportable(Builder $query): Builder
    {
        return $query->with([
            'reporter',
            'resolver',
            'reportable' => fn (MorphTo $morph) => $morph->morphWith(self::REPORTABLE_RELATIONS),
        ]);
    }

    private function loadReportable(Report $report): Report
    {
        return $report->load(['reportable' => fn (MorphTo $morph) => $morph->morphWith(self::REPORTABLE_RELATIONS)]);
    }

    private function reportedStation(Report $report): Station
    {
        $content = $this->loadReportable($report)->reportable;
        $station = match (true) {
            $content instanceof Station => $content,
            $content instanceof Episode => $content->station,
            $content instanceof GiftMessage => $content->giftTransaction?->station,
            $content instanceof ChatMessage => $content->station,
            $content instanceof StationStory => $content->station,
            default => null,
        };

        if (! $station instanceof Station) {
            throw ValidationException::withMessages(['report' => 'No encontramos la emisora de este contenido.']);
        }

        return $station;
    }
}
