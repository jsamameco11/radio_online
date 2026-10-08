<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Actions\AddFactoryEffect;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Studio\Concerns\RespondsWithSnapshot;
use App\Http\Requests\Studio\ConsoleEffectRequest;
use App\Http\Requests\Studio\ConsoleLayerRequest;
use App\Http\Requests\Studio\ConsolePadsRequest;
use App\Http\Requests\Studio\ConsoleStopLayerRequest;
use App\Http\Requests\Studio\ConsoleUpdateLayerRequest;
use App\Http\Resources\BroadcastTrackResource;
use App\Models\Track;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The pad bank, the simultaneous players and the beds: library audios on top of the program. */
class ConsoleLayerController extends Controller
{
    use RespondsWithSnapshot;

    public function __construct(
        private readonly LiveDesk $desk,
        private readonly StationBroadcast $broadcast,
    ) {}

    public function play(ConsoleLayerRequest $request): JsonResponse
    {
        $track = Track::query()->where('active', true)->find($request->validated('track'));
        if (! $track) {
            return response()->json(['message' => 'Ese audio ya no está en la biblioteca.'], 404);
        }
        $duck = $request->validated('duck');
        $layer = $this->desk->playLayer(
            $track,
            $request->validated('lane'),
            (int) $request->validated('volume', 100),
            $duck === null ? $track->duck : (bool) $duck,
            (float) $request->validated('fade_in', 0),
            (float) $request->validated('fade_out', 0),
            $request->boolean('loop'),
            $request->validated('layer'),
            $request->validated('at') === null ? null : (int) $request->validated('at'),
        );

        return $this->snapshot(null, ['layer' => $layer]);
    }

    public function stop(ConsoleStopLayerRequest $request): JsonResponse
    {
        $lane = $request->validated('lane');
        $id = $request->validated('layer');
        $fade = (float) $request->validated('fade', 0);

        return $fade > 0
            ? $this->snapshot(null, ['faded' => $this->desk->fadeLayers($lane, $id, $fade)])
            : $this->snapshot(null, ['stopped' => $this->desk->stopLayers($lane, $id)]);
    }

    public function update(ConsoleUpdateLayerRequest $request, string $layer): JsonResponse
    {
        $updated = $this->desk->updateLayer($layer, (int) $request->validated('volume'), $request->boolean('duck'));
        if ($updated === null) {
            return response()->json(['message' => 'Ese audio ya terminó.'], 404);
        }

        return $this->snapshot(null, ['layer' => $updated]);
    }

    /** Saves which library audios fill the pad bank, in order. */
    public function pads(ConsolePadsRequest $request): JsonResponse
    {
        $ids = $request->validated('tracks');
        $known = Track::query()->whereIn('id', $ids)->pluck('id')->all();
        $this->broadcast->saveConfig([
            'pads' => array_values(array_filter($ids, fn (string $id) => in_array($id, $known, true))),
            'pads_offered' => true,
        ]);

        return response()->json(['message' => 'Botonera guardada.', 'pads' => $this->bank($request)]);
    }

    /**
     * A factory effect joins the library (and, with «pad», the end of the pad bank). Answers 409
     * «audio» when nobody stored it yet: the console then renders it and sends it again.
     */
    public function effect(ConsoleEffectRequest $request, AddFactoryEffect $add): JsonResponse
    {
        $title = trim($request->validated('title'));
        $pad = $request->boolean('pad');
        $result = $add->handle(
            $request->validated('id'),
            $request->validated('version'),
            $title,
            trim($request->validated('category')),
            (float) $request->validated('duration'),
            $request->file('audio'),
            $pad,
        );

        return response()->json([
            'message' => match (true) {
                ! $pad => null,
                $result['added'] => "«{$title}» agregado a la botonera.",
                default => "«{$title}» ya está en la botonera.",
            },
            'track' => BroadcastTrackResource::make($result['track'])->resolve($request),
            'pads' => $pad ? $this->bank($request) : null,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function bank(Request $request): array
    {
        return BroadcastTrackResource::collection($this->broadcast->pads())->resolve($request);
    }
}
