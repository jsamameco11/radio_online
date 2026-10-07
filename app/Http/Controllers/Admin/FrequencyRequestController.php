<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Frequencies\Actions\ApproveFrequencyRequest;
use App\Domain\Frequencies\Actions\RejectFrequencyRequest;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ApproveFrequencyRequestRequest;
use App\Http\Requests\Admin\RejectFrequencyRequestRequest;
use App\Http\Resources\Admin\FrequencyRequestResource;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Solicitudes: frequency requests waiting for review, and the decided ones. */
class FrequencyRequestController extends Controller
{
    private const TABS = [
        'pending' => [FrequencyRequestStatus::Pending],
        'approved' => [FrequencyRequestStatus::Approved],
        'rejected' => [FrequencyRequestStatus::Rejected, FrequencyRequestStatus::Cancelled],
    ];

    public function index(Request $request): Response
    {
        $tab = array_key_exists($request->string('tab')->toString(), self::TABS) ? $request->string('tab')->toString() : 'pending';
        $kind = FrequencyRequestKind::tryFrom($request->string('kind')->toString());

        $page = FrequencyRequest::query()
            ->whereIn('status', array_map(fn (FrequencyRequestStatus $status) => $status->value, self::TABS[$tab]))
            ->when($kind, fn (Builder $query, FrequencyRequestKind $kind) => $query->where('kind', $kind->value))
            ->with(['user', 'reviewer', 'frequency.station', 'station.frequency'])
            ->orderBy($tab === 'pending' ? 'created_at' : 'reviewed_at', $tab === 'pending' ? 'asc' : 'desc')
            ->paginate(20)
            ->withQueryString();

        FrequencyRequestResource::attachCategories($page->getCollection());
        $page->through(function (FrequencyRequest $item) use ($request) {
            $data = FrequencyRequestResource::make($item)->resolve($request);

            return [...$data, 'alternatives' => $data['conflict'] ? $this->alternatives($item->frequency) : []];
        });

        $counts = FrequencyRequest::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('Admin/Requests/Index', [
            'requests' => $page,
            'tab' => $tab,
            'kind' => $kind?->value ?? '',
            'counts' => collect(self::TABS)
                ->map(fn (array $statuses) => (int) collect($statuses)->sum(fn (FrequencyRequestStatus $status) => $counts[$status->value] ?? 0))
                ->all(),
            'kinds' => collect(FrequencyRequestKind::cases())->map(fn (FrequencyRequestKind $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
        ]);
    }

    public function approve(ApproveFrequencyRequestRequest $request, FrequencyRequest $frequencyRequest, ApproveFrequencyRequest $approve): RedirectResponse
    {
        $station = $approve->handle(
            $frequencyRequest,
            $request->user(),
            $request->filled('frequency') ? $request->alternative() : null,
            $request->validated('note'),
        );

        return back()->with('success', "Solicitud aprobada: {$station->displayName()}.");
    }

    public function reject(RejectFrequencyRequestRequest $request, FrequencyRequest $frequencyRequest, RejectFrequencyRequest $reject): RedirectResponse
    {
        $reject->handle($frequencyRequest, $request->user(), (string) $request->validated('note'));

        return back()->with('success', 'Solicitud rechazada. Le avisamos a quien la envió.');
    }

    /**
     * Free frequencies closest to the requested one, for when it was taken.
     *
     * @return list<string>
     */
    private function alternatives(Frequency $taken): array
    {
        return Frequency::query()
            ->available()
            ->orderByRaw('abs(frequency - ?)', [(float) $taken->frequency])
            ->limit(6)
            ->pluck('label')
            ->sort()
            ->values()
            ->all();
    }
}
