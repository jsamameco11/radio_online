<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Actions\RescheduleBlock;
use App\Domain\Studio\Broadcast\Schedule;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Studio\Concerns\RespondsWithSnapshot;
use App\Http\Requests\Studio\BlocksRequest;
use App\Http\Requests\Studio\RescheduleBlockRequest;
use App\Models\ScheduleSlot;
use Illuminate\Http\JsonResponse;

/** The main program from the console: «Al aire ahora» and moving a block the console warns about. */
class ConsoleProgramController extends Controller
{
    use RespondsWithSnapshot;

    /** The chosen audios (or a live block) replace what plays on the main program right away. */
    public function launch(BlocksRequest $request, Schedule $schedule): JsonResponse
    {
        $schedule->insertNow($request->blocks(ScheduleSlot::MAIN));

        return $this->snapshot('Al aire ahora. La programación siguiente se corrió para darle espacio.');
    }

    public function reschedule(RescheduleBlockRequest $request, string $slot, RescheduleBlock $reschedule): JsonResponse
    {
        $minutes = $request->validated('minutes');

        return $this->snapshot($reschedule->handle(
            ScheduleSlot::query()->findOrFail($slot),
            $minutes === null ? null : (int) $minutes,
            $request->validated('date'),
            $request->validated('time'),
        ));
    }
}
