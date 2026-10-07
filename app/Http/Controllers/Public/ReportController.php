<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Moderation\Actions\ReportContent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ReportContentRequest;
use App\Models\Frequency;
use Illuminate\Http\RedirectResponse;

/** Listeners flag a station or one of its episodes for the moderation team. */
class ReportController extends Controller
{
    private const THANKS = 'Gracias por avisarnos. El equipo de moderación revisará tu reporte.';

    public function station(ReportContentRequest $request, Frequency $frequency, StationDirectory $stations, ReportContent $report): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $report->handle($request->user(), $station, $request->reason(), $request->details());

        return back()->with('success', self::THANKS);
    }

    public function episode(ReportContentRequest $request, Frequency $frequency, string $episode, StationDirectory $stations, EpisodeCatalog $episodes, ReportContent $report): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $subject = $episodes->ofStation($station)->whereKey($episode)->firstOrFail();
        $report->handle($request->user(), $subject, $request->reason(), $request->details());

        return back()->with('success', self::THANKS);
    }
}
