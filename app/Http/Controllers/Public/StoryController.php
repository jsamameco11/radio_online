<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Moderation\Actions\ReportContent;
use App\Domain\Stories\Actions\RecordStoryView;
use App\Domain\Stories\StoryFeed;
use App\Domain\Stories\Support\StoryViewer;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ReportContentRequest;
use App\Http\Resources\StationResource;
use App\Http\Resources\StoryResource;
use App\Models\Frequency;
use App\Models\StationStory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The stations' estados as listeners watch them: the rail, each station's stories, views and reports. */
class StoryController extends Controller
{
    public function __construct(private readonly StationDirectory $stations) {}

    public function rail(Request $request, StoryFeed $feed): JsonResponse
    {
        $items = $feed->rail($request->user(), StoryViewer::key($request));

        return response()->json([
            'stations' => array_map(fn (array $item) => [
                'station' => StationResource::make($item['station'])->resolve($request),
                'count' => $item['count'],
                'latest_at' => $item['latest_at']->toIso8601String(),
                'seen' => $item['seen'],
            ], $items),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function index(Request $request, Frequency $frequency, StoryFeed $feed): JsonResponse
    {
        $station = $this->stations->onFrequencyOrFail($frequency);

        return response()->json([
            'station' => StationResource::make($station)->resolve($request),
            'stories' => StoryResource::collection($feed->ofStation($station, StoryViewer::key($request)))->resolve($request),
            'report_reasons' => ReportContentRequest::reasonOptions(),
        ])->header('Cache-Control', 'no-store, private');
    }

    public function view(Request $request, Frequency $frequency, string $story, RecordStoryView $record): JsonResponse
    {
        $record->handle($this->find($frequency, $story), StoryViewer::key($request), $request->user());

        return response()->json(['seen' => true]);
    }

    public function report(ReportContentRequest $request, Frequency $frequency, string $story, ReportContent $report): JsonResponse
    {
        $report->handle($request->user(), $this->find($frequency, $story), $request->reason(), $request->details());

        return response()->json(['message' => 'Gracias por avisarnos. El equipo de moderación revisará este estado.']);
    }

    private function find(Frequency $frequency, string $story): StationStory
    {
        $station = $this->stations->onFrequencyOrFail($frequency);

        return StationStory::acrossStations()->active()->where('station_id', $station->id)->whereKey($story)->firstOrFail();
    }
}
