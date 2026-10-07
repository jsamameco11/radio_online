<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Frequencies\Actions\CancelFrequencyRequest;
use App\Domain\Frequencies\Actions\RequestFrequencyChange;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\RequestFrequencyChangeRequest;
use App\Models\AuditLog;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Configuración > Frecuencia: where the station is on the dial and asking to move. */
class FrequencySettingsController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function show(PlatformSettings $settings): Response
    {
        $station = $this->current->get()->loadMissing('frequency');

        $requests = FrequencyRequest::query()
            ->where('station_id', $station->id)
            ->where('kind', FrequencyRequestKind::FrequencyChange->value)
            ->with(['frequency', 'user'])
            ->latest()
            ->limit(20)
            ->get();

        return Inertia::render('Studio/Settings/Frequency', [
            'frequency' => [
                'label' => $station->frequency->label,
                'display' => $station->frequency->display(),
                'activated_at' => $station->frequency->activated_at?->toIso8601String(),
            ],
            'pending' => $requests->first(fn (FrequencyRequest $item) => $item->status === FrequencyRequestStatus::Pending)?->id,
            'requests' => $requests->map(fn (FrequencyRequest $item) => [
                'id' => $item->id,
                'frequency' => $item->frequency->display(),
                'reason' => $item->pitch,
                'status' => $item->status->value,
                'status_label' => $item->status->label(),
                'requested_by' => $item->user->name,
                'review_note' => $item->review_note,
                'created_at' => $item->created_at->toIso8601String(),
                'reviewed_at' => $item->reviewed_at?->toIso8601String(),
            ])->all(),
            'history' => AuditLog::query()
                ->where('station_id', $station->id)
                ->where('action', 'station.frequency_changed')
                ->latest('created_at')
                ->limit(20)
                ->get(['meta', 'created_at'])
                ->map(fn (AuditLog $log) => [
                    'from' => $log->meta['from'] ?? null,
                    'to' => $log->meta['to'] ?? null,
                    'at' => $log->created_at->toIso8601String(),
                ])
                ->all(),
            'suggestions' => Frequency::query()
                ->available()
                ->orderByRaw('abs(frequency - ?)', [(float) $station->frequency->frequency])
                ->limit(12)
                ->pluck('label')
                ->sort()
                ->values()
                ->all(),
            'open' => (bool) $settings->get('frequency_requests_open'),
        ]);
    }

    public function store(RequestFrequencyChangeRequest $request, RequestFrequencyChange $change): RedirectResponse
    {
        $change->handle($this->current->get(), $request->user(), $request->target(), (string) $request->validated('reason'));

        return back()->with('success', 'Enviamos tu solicitud. El equipo de la plataforma la revisará pronto.');
    }

    public function destroy(Request $request, FrequencyRequest $frequencyRequest, CancelFrequencyRequest $cancel): RedirectResponse
    {
        abort_unless((int) $frequencyRequest->station_id === $this->current->id(), 404);

        $cancel->handle($frequencyRequest, $request->user());

        return back()->with('success', 'Retiraste la solicitud de cambio de frecuencia.');
    }
}
