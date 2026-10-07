<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ReportContentRequest;
use App\Http\Resources\EpisodeResource;
use App\Http\Resources\StationResource;
use App\Models\Episode;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The page of a station: /radio/89-30. */
class StationController extends Controller
{
    public function show(Request $request, Frequency $frequency, StationDirectory $stations, EpisodeCatalog $episodes): Response
    {
        $station = $stations->onFrequencyOrFail($frequency);

        $related = $stations->query()
            ->whereKeyNot($station->id)
            ->whereHas('categories', fn (Builder $category) => $category->whereIn('categories.id', $station->categories->pluck('id')))
            ->orderByDesc('listener_count')
            ->orderByDesc('follower_count')
            ->limit(6)
            ->get();

        return Inertia::render('Public/Station', [
            ...self::context($request->user(), $station),
            'about' => [
                'description' => $station->description,
                'language' => $station->language,
                'country' => $station->country,
                'peak_listener_count' => $station->peak_listener_count,
                'went_live_at' => $station->went_live_at?->toIso8601String(),
                'created_at' => $station->created_at->toIso8601String(),
            ],
            'episodes' => $episodes->ofStation($station)
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Episode $episode) => EpisodeResource::make($episode)->resolve($request)),
            'related' => StationResource::collection($related)->resolve($request),
        ]);
    }

    /**
     * What every page of a station needs: the station, whether the viewer
     * follows it, its studio for its team, and how to share and report it.
     *
     * @return array<string, mixed>
     */
    public static function context(User $user, Station $station): array
    {
        $slug = $station->frequency->slug;

        return [
            'station' => StationResource::make($station)->resolve(),
            'isFollowing' => $user->follows()->whereKey($station->id)->exists(),
            'studioUrl' => $user->roleIn($station) === null ? null : rtrim((string) config('platform.urls.control'), '/').'/estudio/'.$slug,
            'shareUrl' => rtrim((string) config('platform.urls.public'), '/').'/radio/'.$slug,
            'reportReasons' => ReportContentRequest::reasonOptions(),
        ];
    }
}
