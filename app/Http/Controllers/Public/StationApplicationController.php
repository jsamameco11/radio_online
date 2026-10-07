<?php

namespace App\Http\Controllers\Public;

use App\Domain\Applications\Actions\PurgeApplicationDocuments;
use App\Domain\Applications\Actions\SubmitStationApplication;
use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Enums\EducationLevel;
use App\Domain\Applications\Enums\Weekday;
use App\Domain\Applications\Support\ApplicationLimits;
use App\Domain\Discovery\Queries\CategoryCatalog;
use App\Domain\Frequencies\Actions\CancelFrequencyRequest;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Platform\PlatformHost;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\Locales;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\SubmitStationApplicationRequest;
use App\Http\Resources\Site\FrequencyRequestResource;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Station;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/** "Crear mi radio": the dossier of whoever will run the station, its documents and the project, for the platform to review. */
class StationApplicationController extends Controller
{
    public function create(Request $request, CategoryCatalog $categories, PlatformSettings $settings): Response
    {
        $user = $request->user();
        $options = fn (array $cases) => array_map(fn ($case) => ['value' => $case->value, 'label' => $case->label()], $cases);

        return Inertia::render('Public/CreateStation', [
            'frequencies' => Frequency::query()
                ->available()
                ->onDial()
                ->get(['id', 'label', 'slug', 'frequency'])
                ->map(fn (Frequency $frequency) => ['id' => $frequency->id, 'label' => $frequency->label, 'slug' => $frequency->slug])
                ->values()
                ->all(),
            'band' => [
                'name' => config('platform.dial.band'),
                'min' => (float) config('platform.dial.min'),
                'max' => (float) config('platform.dial.max'),
            ],
            'categories' => $categories->grouped(),
            'maxCategories' => (int) config('platform.stations.max_categories'),
            'open' => (bool) $settings->get('frequency_requests_open'),
            'options' => [
                'documentTypes' => array_map(fn (DocumentType $type) => [
                    'value' => $type->value,
                    'label' => $type->label(),
                    'pattern' => $type->pattern(),
                    'hint' => $type->hint(),
                ], DocumentType::cases()),
                'educationLevels' => $options(EducationLevel::cases()),
                'contentTypes' => $options(ContentType::cases()),
                'weekdays' => $options(Weekday::cases()),
                'countries' => Locales::options(Locales::COUNTRIES),
                'languages' => Locales::options(Locales::LANGUAGES),
                'socialNetworks' => ApplicationLimits::SOCIAL_NETWORKS,
            ],
            'limits' => [...ApplicationLimits::forForm(), 'retentionDays' => PurgeApplicationDocuments::RETENTION_DAYS],
            'requests' => FrequencyRequestResource::collection(
                $user->frequencyRequests()
                    ->where('kind', FrequencyRequestKind::NewStation->value)
                    ->with('frequency')
                    ->latest()
                    ->latest('id')
                    ->limit(10)
                    ->get(),
            )->resolve($request),
            'hasPending' => Gate::denies('create', FrequencyRequest::class),
            'myStations' => $user->stations()
                ->with('frequency')
                ->orderBy('name')
                ->get()
                ->map(fn (Station $station) => [
                    'id' => $station->id,
                    'display_name' => $station->displayName(),
                    'role' => StationRole::from($station->pivot->role)->label(),
                    'studio_url' => PlatformHost::Studio->url($station->frequency->slug),
                    'public_url' => '/radio/'.$station->frequency->slug,
                ])
                ->values()
                ->all(),
            'preselected' => $request->string('frecuencia')->toString() ?: null,
        ]);
    }

    public function store(SubmitStationApplicationRequest $request, SubmitStationApplication $submit): RedirectResponse
    {
        $submission = $request->submission();
        $submit->handle($request->user(), $submission, (string) $request->ip(), $request->userAgent());

        return redirect()->route('site.station-requests.create')
            ->with('success', "¡Listo! Recibimos tu solicitud para {$submission->frequency->display()}. Te avisaremos por correo cuando la revisemos.");
    }

    public function destroy(Request $request, FrequencyRequest $frequencyRequest, CancelFrequencyRequest $cancel, PurgeApplicationDocuments $purge): RedirectResponse
    {
        Gate::authorize('cancel', $frequencyRequest);
        $cancel->handle($frequencyRequest, $request->user());

        $application = $frequencyRequest->application()->first();
        if ($application !== null) {
            $purge->handle($application->setRelation('frequencyRequest', $frequencyRequest), $request->user());
        }

        return back()->with('success', $application === null ? 'Cancelaste tu solicitud.' : 'Cancelaste tu solicitud y eliminamos los documentos que nos enviaste.');
    }
}
