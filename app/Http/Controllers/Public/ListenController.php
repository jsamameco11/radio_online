<?php

namespace App\Http\Controllers\Public;

use App\Domain\Integrity\Support\RequestSignals;
use App\Domain\Streaming\Audience;
use App\Domain\Streaming\PlaybackHealth;
use App\Domain\Streaming\Support\Tuner;
use App\Domain\Streaming\VoiceSignal;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ListenerRequest;
use App\Http\Requests\Public\ListenFailureRequest;
use App\Http\Requests\Public\ListenVoiceRequest;
use App\Models\Track;
use Illuminate\Http\JsonResponse;

/**
 * What a station player talks to: the program it computes what to play from, its presence in
 * the audience, the live-microphone handshake and the audios it could not play.
 */
class ListenController extends Controller
{
    public function __construct(
        private readonly Tuner $tuner,
        private readonly StationBroadcast $broadcast,
        private readonly VoiceSignal $signal,
    ) {}

    public function state(ListenerRequest $request, string $frequency): JsonResponse
    {
        $this->tuner->tune($frequency);
        $state = $this->broadcast->state();
        if ($id = $request->listener()) {
            $state['voice'] = $this->signal->voiceOf($this->signal->touch($id), $state['live']['session']);
        }

        return response()->json($state)->header('Cache-Control', 'no-store, private');
    }

    public function heartbeat(ListenerRequest $request, string $frequency, Audience $audience): JsonResponse
    {
        $station = $this->tuner->tune($frequency);
        $audience->heartbeat($station, (string) $request->listener(), $request->user(), Tuner::device($request), Tuner::country($request), RequestSignals::from($request));

        return response()->json(['listeners' => $station->listener_count]);
    }

    public function leave(ListenerRequest $request, string $frequency, Audience $audience): JsonResponse
    {
        $station = $this->tuner->tune($frequency);
        $id = (string) $request->listener();
        $this->signal->leave($id);
        $audience->leave($station, $id);

        return response()->json(['ok' => true]);
    }

    public function voice(ListenVoiceRequest $request, string $frequency): JsonResponse
    {
        $this->tuner->tune($frequency);
        $session = $this->broadcast->state()['live']['session'];
        if (! $session || $request->validated('session') !== $session) {
            return response()->json(['message' => 'La transmisión en vivo ya terminó.'], 409);
        }
        $this->signal->request((string) $request->listener(), $session);

        return response()->json(['ok' => true]);
    }

    public function answer(ListenVoiceRequest $request, string $frequency): JsonResponse
    {
        $this->tuner->tune($frequency);
        $answered = $this->signal->answer((string) $request->listener(), $request->validated('session'), $request->validated('sdp'));

        return $answered
            ? response()->json(['ok' => true])
            : response()->json(['message' => 'La conexión expiró. Volvemos a intentarlo.'], 409);
    }

    /** A player could not play an audio: the station checks it (see PlaybackHealth). */
    public function failed(ListenFailureRequest $request, string $frequency, PlaybackHealth $health): JsonResponse
    {
        $this->tuner->tune($frequency);
        $track = Track::query()->find($request->validated('track'));
        if (! $track) {
            return response()->json(['message' => 'Ese audio no está en la radio.'], 404);
        }
        $health->report($track, (string) $request->ip());

        return response()->json(['ok' => true], 202);
    }
}
