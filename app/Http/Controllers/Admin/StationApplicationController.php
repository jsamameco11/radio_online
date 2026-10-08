<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Storage\MediaStorage;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\FrequencyRequestResource;
use App\Http\Resources\Admin\StationApplicationResource;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\StationApplication;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Solicitudes > Expediente: the applicant's full dossier and documents, to approve or reject the request. */
class StationApplicationController extends Controller
{
    public function show(Request $request, FrequencyRequest $frequencyRequest): Response
    {
        $frequencyRequest->load(['user', 'reviewer', 'frequency.station', 'station.frequency', 'application']);
        $application = $frequencyRequest->application ?? abort(404);
        $user = $frequencyRequest->user;

        FrequencyRequestResource::attachCategories([$frequencyRequest]);
        $summary = FrequencyRequestResource::make($frequencyRequest)->resolve($request);

        return Inertia::render('Admin/Applications/Show', [
            'request' => $summary,
            'freeFrequencies' => Frequency::freeOptions(),
            'application' => StationApplicationResource::make($application)->resolve($request),
            'account' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified' => $user->hasVerifiedEmail(),
                'status' => $user->status->value,
                'status_label' => $user->status->label(),
                'created_at' => $user->created_at->toIso8601String(),
                'requests' => $user->frequencyRequests()->where('kind', FrequencyRequestKind::NewStation->value)->count(),
                'stations' => $user->memberships()->count(),
            ],
            'duplicates' => StationApplication::query()
                ->where('document_hash', $application->document_hash)
                ->whereKeyNot($application->id)
                ->with(['frequencyRequest.user', 'frequencyRequest.frequency'])
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (StationApplication $other) => [
                    'request_id' => $other->frequency_request_id,
                    'station_name' => $other->frequencyRequest->station_name,
                    'frequency' => $other->frequencyRequest->frequency->display(),
                    'status' => $other->frequencyRequest->status->value,
                    'status_label' => $other->frequencyRequest->status->label(),
                    'applicant' => $other->frequencyRequest->user->name,
                    'same_account' => $other->frequencyRequest->user_id === $user->id,
                    'created_at' => $other->created_at->toIso8601String(),
                ])
                ->values()
                ->all(),
        ]);
    }

    /** Redirects to a short-lived URL of one document; every view is audited. */
    public function file(FrequencyRequest $frequencyRequest, string $file, MediaStorage $storage, AuditTrail $audit): RedirectResponse
    {
        $application = $frequencyRequest->application()->first() ?? abort(404);
        $document = $application->documents()[$file] ?? abort(404);

        $audit->record('frequency_request.document_viewed', $frequencyRequest, ['file' => $file]);

        return redirect()->away((string) $storage->url($document['key'], now()->addMinutes(5)))
            ->header('Cache-Control', 'no-store, private');
    }
}
