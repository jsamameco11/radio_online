<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Actions\ChooseRotation;
use App\Domain\Studio\Actions\PlaceAutomaticPeriod;
use App\Domain\Studio\Actions\PlaceBlocks;
use App\Domain\Studio\Actions\UpdateBlock;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastLibrary;
use App\Domain\Studio\Broadcast\ProgramEngine;
use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\BlocksRequest;
use App\Http\Requests\Studio\CopyScheduleDayRequest;
use App\Http\Requests\Studio\ProgramRangeRequest;
use App\Http\Requests\Studio\ScheduleBlockRequest;
use App\Http\Requests\Studio\ScheduleRotationRequest;
use App\Http\Requests\Studio\UpdateScheduleBlockRequest;
use App\Models\ScheduleSlot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio › Programación: the timeline of each day, its overlay layers and the automatic music. */
class ScheduleController extends Controller
{
    /** Days the day picker shows from today on. */
    private const OVERVIEW_DAYS = 21;

    /** Most items the program view resolves at once. */
    private const PROGRAM_LIMIT = 900;

    /** Fields of a program item the views need. */
    private const PROGRAM_FIELDS = ['id', 'kind', 'title', 'artist', 'start', 'end', 'origin', 'bed', 'block', 'slot', 'track'];

    public function __construct(private readonly Schedule $schedule) {}

    public function index(Request $request, BroadcastLibrary $library, StationBroadcast $broadcast): Response
    {
        $today = BroadcastClock::today();
        $date = BroadcastClock::date($request->query('dia')) ?? $today;

        return Inertia::render('Studio/Schedule', [
            'date' => $date,
            'today' => $today,
            'timezone' => BroadcastClock::timezone(),
            'now' => BroadcastClock::nowMs(),
            'bounds' => BroadcastClock::dayBounds($date),
            'blocks' => $this->schedule->day($date),
            'dayEnds' => $this->schedule->dayEnds($date),
            'days' => $this->schedule->overview($today, self::OVERVIEW_DAYS),
            'tracks' => $library->tracks($request),
            'playlists' => $library->playlists(),
            'autopilot' => $broadcast->autopilot(),
            'crossfade' => (float) $broadcast->config()['crossfade'],
            'layers' => collect(range(ScheduleSlot::MAIN, ScheduleSlot::OVERLAYS))
                ->map(fn (int $layer) => ['value' => $layer, 'label' => Schedule::layerLabel($layer)])->values()->all(),
            'maxTracks' => BlocksRequest::MAX_TRACKS,
        ]);
    }

    /** What will sound between two moments, song by song, with the automatic music already resolved. */
    public function program(ProgramRangeRequest $request, ProgramEngine $engine): JsonResponse
    {
        [$from, $to] = $request->range();
        $fields = array_flip(self::PROGRAM_FIELDS);

        return response()->json([
            'items' => array_map(fn (array $item) => array_intersect_key($item, $fields), $engine->items($from, $to, true, self::PROGRAM_LIMIT)),
            'now' => BroadcastClock::nowMs(),
        ]);
    }

    public function store(ScheduleBlockRequest $request, PlaceBlocks $place, PlaceAutomaticPeriod $period): JsonResponse
    {
        $layer = $request->layer();
        $mode = $request->validated('mode');
        $time = $request->validated('time');
        if ($request->validated('type') === BlocksRequest::AUTO) {
            if ($layer !== ScheduleSlot::MAIN) {
                throw ValidationException::withMessages(['layer' => 'La música automática va en la pista principal.']);
            }
            $note = trim((string) $request->validated('note')) ?: null;

            return $this->saved($period->handle($request->playlist(), $request->boolean('shuffle', true), $request->day(), $mode, $time, $request->validated('until'), $note));
        }

        return $this->saved($place->handle($request->blocks($layer), $layer, $request->day(), $mode, $time));
    }

    public function update(UpdateScheduleBlockRequest $request, string $slot, UpdateBlock $update): JsonResponse
    {
        $update->handle(ScheduleSlot::query()->findOrFail($slot), $request->changes());

        return $this->saved('Bloque actualizado.');
    }

    public function destroy(string $slot): JsonResponse
    {
        ScheduleSlot::query()->findOrFail($slot)->delete();
        $this->schedule->flush();

        return $this->saved('Bloque quitado de la programación.');
    }

    public function clear(string $date): JsonResponse
    {
        $day = BroadcastClock::date($date);
        abort_if($day === null, 404);
        $removed = $this->schedule->clearDay($day);

        return $this->saved($removed ? "Se quitaron {$removed} bloques del día." : 'No había bloques por quitar.');
    }

    public function copy(CopyScheduleDayRequest $request): JsonResponse
    {
        $targets = $request->targets();
        [$copied, $skipped] = $this->schedule->copyDay($request->validated('date'), $targets, $request->boolean('replace'));

        return $this->saved("Se copiaron {$copied} bloques a ".count($targets).' día(s).'
            .($skipped ? " {$skipped} no se copiaron porque se cruzaban con bloques ya programados." : ''));
    }

    /** «Música continua»: exactly the chosen songs repeat in the automatic music. */
    public function rotation(ScheduleRotationRequest $request, ChooseRotation $choose): JsonResponse
    {
        $count = $choose->handle($request->tracks());

        return $this->saved($count
            ? "Música continua: {$count} ".($count === 1 ? 'canción' : 'canciones').' en rotación.'
            : 'Música continua vacía: ninguna canción se repite por su cuenta.');
    }

    private function saved(string $message): JsonResponse
    {
        return response()->json(['message' => $message]);
    }
}
