<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Studio\Capture\KeepCapture;
use App\Domain\Studio\Capture\LiveCapture;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Library\StudioAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\CaptureChunkRequest;
use App\Http\Requests\Studio\CaptureFinishRequest;
use App\Http\Requests\Studio\CaptureStartRequest;
use App\Http\Requests\Studio\ConsoleCaptureSaveRequest;
use App\Models\Recording;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Records the operator's live transmission and, when it ends, keeps it as a library audio (and episode). */
class ConsoleCaptureController extends Controller
{
    public function __construct(private readonly LiveCapture $capture) {}

    public function start(CaptureStartRequest $request): JsonResponse
    {
        $recording = $this->capture->open($request->user(), $request->validated('session'));

        return response()->json(['recording' => LiveCapture::brief($recording)]);
    }

    public function chunk(CaptureChunkRequest $request, string $recording): JsonResponse
    {
        $have = false;
        $saved = $this->capture->append(
            $request->user(),
            $this->own($request, $recording),
            (int) $request->validated('index'),
            $request->file('audio'),
            $request->validated('extension'),
            $have,
        );

        return response()->json(['recording' => LiveCapture::brief($saved), 'duplicate' => $have]);
    }

    public function finish(CaptureFinishRequest $request, string $recording): JsonResponse
    {
        $closed = $this->capture->close($request->user(), $this->own($request, $recording), (float) $request->validated('duration'));

        return response()->json(['recording' => LiveCapture::brief($closed)]);
    }

    public function save(ConsoleCaptureSaveRequest $request, string $recording, KeepCapture $keep, StudioAccess $access): JsonResponse
    {
        $data = $request->validated();
        if (! empty($data['episode'])) {
            $access->authorize($request->user(), StationPermission::ManageEpisodes);
        }
        ['track' => $track, 'episode' => $episode] = $keep->handle($this->own($request, $recording), $data, $request->file('cover'));

        return response()->json(['message' => match (true) {
            $episode === null => "Guardamos «{$track->title}» en la biblioteca.",
            $episode->status === EpisodeStatus::Published => "Guardamos «{$track->title}» en la biblioteca y publicamos su episodio: los oyentes ya pueden escucharlo.",
            default => "Guardamos «{$track->title}» en la biblioteca y creamos su episodio como borrador.",
        }]);
    }

    public function discard(Request $request, string $recording): JsonResponse
    {
        $this->capture->discard($request->user(), $this->own($request, $recording));

        return response()->json(['message' => 'Grabación descartada.']);
    }

    /** Operators only touch their own recordings. */
    private function own(Request $request, string $id): Recording
    {
        return Recording::query()->where('user_id', $request->user()->id)->findOrFail($id);
    }
}
