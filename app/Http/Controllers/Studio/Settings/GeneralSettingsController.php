<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Stations\Actions\UpdateStationDetails;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationLinks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\UpdateGeneralSettingsRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Configuración > General: the station name and who can find it. */
class GeneralSettingsController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function edit(): Response
    {
        $station = $this->current->get()->loadMissing(['frequency', 'owner']);

        return Inertia::render('Studio/Settings/General', [
            'settings' => [
                'name' => $station->name,
                'visibility' => $station->visibility->value,
            ],
            'visibilities' => collect(StationVisibility::cases())
                ->map(fn (StationVisibility $item) => ['value' => $item->value, 'label' => $item->label()])
                ->all(),
            'details' => [
                'frequency' => $station->frequency->display(),
                'owner' => $station->owner->name,
                'status_label' => $station->status->label(),
                'created_at' => $station->created_at->toIso8601String(),
                'listen_url' => StationLinks::listen($station),
            ],
        ]);
    }

    public function update(UpdateGeneralSettingsRequest $request, UpdateStationDetails $update): RedirectResponse
    {
        $update->handle($this->current->get(), $request->validated(), $request->user());

        return back()->with('success', 'Guardamos la configuración general.');
    }
}
