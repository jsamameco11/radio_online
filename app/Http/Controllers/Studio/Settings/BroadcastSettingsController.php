<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Broadcast\BroadcastConfig;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Enums\LiveMode;
use App\Domain\Studio\Enums\LiveSource;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\BroadcastSettingsRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio › Configuración › Transmisión: on air, titles, the live switch and its source, audio quality. */
class BroadcastSettingsController extends Controller
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly BroadcastConfig $config,
        private readonly CurrentStation $current,
    ) {}

    public function edit(): Response
    {
        $config = $this->config->all();

        return Inertia::render('Studio/Settings/Broadcast', [
            'settings' => [
                ...$this->config->group('broadcast'),
                'stream_url' => $config['stream_url'],
                'bitrate_kbps' => $config['bitrate_kbps'],
            ],
            'liveModes' => array_map(fn (LiveMode $mode) => ['value' => $mode->value, 'label' => $mode->label()], LiveMode::cases()),
            'liveSources' => array_map(fn (LiveSource $source) => ['value' => $source->value, 'label' => $source->label()], LiveSource::cases()),
            'bitrates' => BroadcastSettingsRequest::BITRATES,
            'maxVoice' => BroadcastSettingsRequest::MAX_VOICE,
        ]);
    }

    public function update(BroadcastSettingsRequest $request, AuditTrail $audit): RedirectResponse
    {
        $station = $this->current->get();
        $settings = $request->settings();
        $before = [...$this->config->group('broadcast'), 'stream_url' => (string) $station->external_stream_url, 'bitrate_kbps' => (int) $station->bitrate_kbps];

        $station->forceFill([
            'external_stream_url' => $request->validated('stream_url') ?: null,
            'bitrate_kbps' => (int) $request->validated('bitrate_kbps'),
        ])->save();
        $this->broadcast->saveConfig($settings);
        if ($before['on_air'] !== $settings['on_air']) {
            $this->broadcast->setOnAir($settings['on_air']);
        } else {
            $this->broadcast->syncPresence();
        }

        $after = [...$settings, 'stream_url' => (string) $station->external_stream_url, 'bitrate_kbps' => (int) $station->bitrate_kbps];
        $changed = array_keys(array_filter($after, fn ($value, string $key) => ($before[$key] ?? null) !== $value, ARRAY_FILTER_USE_BOTH));
        if ($changed !== []) {
            $audit->record('station.settings_updated', $station, ['group' => 'broadcast', 'fields' => $changed]);
        }

        return back()->with('success', 'Guardamos la configuración de transmisión.');
    }
}
