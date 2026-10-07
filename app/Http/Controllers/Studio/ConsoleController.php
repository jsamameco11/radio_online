<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\VoiceSignal;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastLibrary;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Capture\LiveCapture;
use App\Domain\Studio\Library\StudioAccess;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Studio\Concerns\RespondsWithSnapshot;
use App\Http\Requests\Studio\ConsoleLiveRequest;
use App\Http\Requests\Studio\ConsoleMixRequest;
use App\Http\Requests\Studio\ConsoleOfferRequest;
use App\Http\Requests\Studio\ConsoleToggleRequest;
use App\Http\Requests\Studio\LiveModeRequest;
use App\Http\Resources\BroadcastTrackResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Estudio › Consola: the live session (the operator's microphone reaches every listener over
 * WebRTC, signalled through here), the station on or off the air and the mix.
 */
class ConsoleController extends Controller
{
    use RespondsWithSnapshot;

    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly LiveDesk $desk,
        private readonly AuditTrail $audit,
        private readonly CurrentStation $current,
    ) {}

    public function index(Request $request, BroadcastLibrary $library, Schedule $schedule, LiveCapture $capture, StudioAccess $access): Response
    {
        $today = BroadcastClock::today();

        return Inertia::render('Studio/Console', [
            'snapshot' => $this->broadcast->snapshot(),
            'pads' => BroadcastTrackResource::collection($this->broadcast->pads())->resolve($request),
            'library' => $library->tracks($request),
            'playlists' => $library->playlists(),
            'kinds' => BroadcastLibrary::kinds(),
            'today' => $today,
            'day' => $schedule->day($today),
            'timezone' => BroadcastClock::timezone(),
            'host' => $request->user()->name,
            'capture' => $capture->pending($request->user()),
            'canEpisodes' => $access->allows($request->user(), StationPermission::ManageEpisodes),
            'canSchedule' => $access->allows($request->user(), StationPermission::ManageSchedule),
            'limits' => [
                'pads' => LiveDesk::MAX_PADS,
                'fade' => LiveDesk::MAX_FADE,
                'operator_timeout' => LiveDesk::OPERATOR_TIMEOUT,
                'chunk_mb' => LiveCapture::CHUNK_MB,
                'recording_mb' => LiveCapture::MAX_MB,
            ],
        ]);
    }

    /**
     * What the console polls every couple of seconds. The operator's poll keeps the live session
     * open and carries the microphone handshake with each listener.
     */
    public function signal(Request $request, VoiceSignal $signal): JsonResponse
    {
        $stored = $this->desk->stored();
        $operator = $stored['session'] !== null && $stored['host_id'] === $request->user()->id;
        if ($operator) {
            $this->desk->heartbeat();
        }
        $snapshot = $this->broadcast->snapshot();
        $session = $snapshot['live']['session'];

        return response()->json([
            'snapshot' => $snapshot,
            'signal' => $operator && $session ? [
                'pending' => $signal->pending($session, (int) $snapshot['config']['max_voice']),
                'answers' => $signal->answers($session),
                'alive' => $signal->alive($session),
            ] : null,
        ]);
    }

    public function offer(ConsoleOfferRequest $request, VoiceSignal $signal): JsonResponse
    {
        $live = $this->desk->stored();
        if (! $live['session'] || $live['host_id'] !== $request->user()->id) {
            return response()->json(['message' => 'Solo quien conduce la transmisión en vivo conecta a los oyentes.'], 409);
        }

        return response()->json(['ok' => $signal->offer($live['session'], $request->validated('id'), $request->validated('sdp'))]);
    }

    public function startLive(ConsoleLiveRequest $request): JsonResponse
    {
        $live = $this->broadcast->startLive($request->user(), $request->host(), $request->title());
        $this->audit->record('broadcast.live_started', $this->current->get(), ['session' => $live['session'], 'title' => $live['title']]);

        return $this->snapshot('Transmisión en vivo abierta. Activa el micrófono cuando quieras hablar.');
    }

    public function endLive(): JsonResponse
    {
        $session = $this->desk->stored()['session'];
        if ($session === null) {
            return $this->snapshot('No había una transmisión en vivo abierta.');
        }
        $this->broadcast->endLive();
        $this->audit->record('broadcast.live_ended', $this->current->get(), ['session' => $session]);

        return $this->snapshot('Transmisión en vivo terminada.');
    }

    public function air(ConsoleToggleRequest $request): JsonResponse
    {
        $on = $request->on();
        $this->broadcast->setOnAir($on);
        $this->audit->record($on ? 'broadcast.on_air' : 'broadcast.off_air', $this->current->get());

        return $this->snapshot($on ? 'La radio está al aire.' : 'La radio salió del aire: los oyentes escuchan silencio.');
    }

    public function mix(ConsoleMixRequest $request): JsonResponse
    {
        $changes = $request->changes();
        if (! empty($changes['mic']) && $this->desk->stored()['session'] === null) {
            return response()->json(['message' => 'Abre la transmisión en vivo para hablar al aire.'], 409);
        }
        $this->desk->update(fn () => $changes);

        return $this->snapshot();
    }

    public function mode(LiveModeRequest $request): JsonResponse
    {
        $mode = $request->mode();
        $this->broadcast->saveConfig(['live_mode' => $mode->value]);

        return $this->snapshot('Modo del vivo: '.mb_strtolower($mode->label()).'.');
    }
}
