<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Broadcast\BroadcastConfig;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\AudioSettingsRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio › Configuración › Audio: crossfade between songs and the levels of beds, effects and ducking. */
class AudioSettingsController extends Controller
{
    public function __construct(private readonly BroadcastConfig $config) {}

    public function edit(): Response
    {
        return Inertia::render('Studio/Settings/Audio', [
            'settings' => array_diff_key($this->config->group('audio'), ['pads' => true]),
            'maxFade' => LiveDesk::MAX_FADE,
            'ranges' => AudioSettingsRequest::RANGES,
        ]);
    }

    public function update(AudioSettingsRequest $request, StationBroadcast $broadcast, AuditTrail $audit, CurrentStation $current): RedirectResponse
    {
        $before = $this->config->group('audio');
        $settings = $request->settings();
        $broadcast->saveConfig($settings);

        $changed = array_keys(array_filter($settings, fn ($value, string $key) => $before[$key] != $value, ARRAY_FILTER_USE_BOTH));
        if ($changed !== []) {
            $audit->record('station.settings_updated', $current->get(), ['group' => 'audio', 'fields' => $changed]);
        }

        return back()->with('success', 'Guardamos la configuración de audio.');
    }
}
