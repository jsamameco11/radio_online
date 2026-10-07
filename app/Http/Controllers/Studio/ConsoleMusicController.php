<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Actions\GoLive;
use App\Domain\Studio\Actions\ReturnToMusic;
use App\Domain\Studio\Actions\StartAutomaticMusic;
use App\Domain\Studio\Actions\SwitchAutomaticMusic;
use App\Domain\Studio\Broadcast\MusicControls;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Studio\Concerns\RespondsWithSnapshot;
use App\Http\Requests\Studio\ConsoleResumeRequest;
use App\Http\Requests\Studio\ConsoleToggleRequest;
use App\Http\Requests\Studio\MusicSourceRequest;
use Illuminate\Http\JsonResponse;

/**
 * The automatic music of the gaps, from the console and from the schedule: start it, change its
 * source without cutting a song, pause it, «Repetir», and the live switch (console only).
 * Every change reaches all listeners at once.
 */
class ConsoleMusicController extends Controller
{
    use RespondsWithSnapshot;

    public function start(MusicSourceRequest $request, StartAutomaticMusic $start): JsonResponse
    {
        return $this->snapshot($start->handle($request->playlist(), $request->shuffle(), $request->validated('first'), $request->repeat()));
    }

    public function source(MusicSourceRequest $request, SwitchAutomaticMusic $switch): JsonResponse
    {
        return $this->snapshot($switch->handle($request->playlist(), $request->shuffle(), $request->immediately(), $request->at()));
    }

    public function cancel(MusicControls $controls): JsonResponse
    {
        return $this->snapshot($controls->cancelSwitch());
    }

    /** Song boundaries where a change of source can land. */
    public function points(StationBroadcast $broadcast): JsonResponse
    {
        return response()->json(['points' => $broadcast->switchPoints()]);
    }

    public function autofill(ConsoleToggleRequest $request, MusicControls $controls): JsonResponse
    {
        return $this->snapshot($controls->autofill($request->on()));
    }

    public function repeat(ConsoleToggleRequest $request, MusicControls $controls): JsonResponse
    {
        return $this->snapshot($controls->repeat($request->on()));
    }

    /** «Ir al vivo»: the automatic music gives way to the live signal. */
    public function cut(GoLive $goLive): JsonResponse
    {
        return $this->snapshot($goLive->handle());
    }

    /** «Volver a la música», optionally with another playlist or order. */
    public function resume(ConsoleResumeRequest $request, ReturnToMusic $return): JsonResponse
    {
        return $this->snapshot($return->handle($request->boolean('change'), $request->playlist(), $request->boolean('shuffle', true)));
    }
}
