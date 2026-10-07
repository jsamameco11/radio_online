<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Actions\SwitchAutomaticMusic;
use App\Domain\Studio\Broadcast\BroadcastLibrary;
use App\Domain\Studio\Broadcast\MusicControls;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\AutomationSettingsRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Estudio › Configuración › Automatización: the automatic music of the gaps. A new source lands
 * when the song on air ends, as from the console.
 */
class AutomationSettingsController extends Controller
{
    public function __construct(private readonly StationBroadcast $broadcast) {}

    public function edit(BroadcastLibrary $library): Response
    {
        $autopilot = $this->broadcast->autopilot();

        return Inertia::render('Studio/Settings/Automation', [
            'settings' => [
                'autofill' => ! $autopilot['paused'],
                'playlist' => $autopilot['playlist'],
                'shuffle' => $autopilot['shuffle'],
                'repeat' => $autopilot['repeat'],
            ],
            'autopilot' => $autopilot,
            'playlists' => $library->playlists(),
        ]);
    }

    public function update(AutomationSettingsRequest $request, MusicControls $controls, SwitchAutomaticMusic $switch, AuditTrail $audit, CurrentStation $current): RedirectResponse
    {
        $before = $this->broadcast->autopilot();
        $playlist = $request->playlist();
        $shuffle = $playlist === null || $request->boolean('shuffle');
        $messages = [];

        if ($before['playlist'] !== $playlist?->id || $before['shuffle'] !== $shuffle) {
            $messages['source'] = $switch->handle($playlist, $shuffle);
        }
        if ($before['repeat'] !== $request->boolean('repeat')) {
            $messages['repeat'] = $controls->repeat($request->boolean('repeat'));
        }
        if ($before['paused'] === $request->boolean('autofill')) {
            $messages['autofill'] = $controls->autofill($request->boolean('autofill'));
        }

        if ($messages !== []) {
            $audit->record('station.settings_updated', $current->get(), ['group' => 'automation', 'fields' => array_keys($messages)]);
        }

        return back()->with('success', $messages ? implode(' ', $messages) : 'No había cambios por guardar.');
    }
}
