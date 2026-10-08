<?php

namespace App\Http\Controllers\Public;

use App\Domain\Access\Support\SessionHandoff;
use App\Domain\Chat\ChatFeed;
use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Platform\PlatformHost;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\StationLinks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ReportContentRequest;
use App\Http\Resources\EpisodeResource;
use App\Http\Resources\StationResource;
use App\Models\Episode;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\StationRating;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The page of a station: /radio/89-30. */
class StationController extends Controller
{
    public function show(Request $request, Frequency $frequency, StationDirectory $stations, EpisodeCatalog $episodes, ChatFeed $chat): Response
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
            'chat' => $chat->forListeners($station, $request->user()),
        ]);
    }

    /**
     * What every page of a station needs: the station, whether the viewer (a guest
     * when null) follows it, their star rating, its studio for its team (and where
     * to change the cover photo for whoever may edit the profile), and how to
     * share and report it.
     *
     * @return array<string, mixed>
     */
    public static function context(?User $user, Station $station): array
    {
        $rating = $user === null
            ? null
            : StationRating::query()->where('station_id', $station->id)->where('user_id', $user->id)->value('stars');

        return [
            'station' => StationResource::make($station)->resolve(),
            'isFollowing' => $user !== null && $user->follows()->whereKey($station->id)->exists(),
            'myRating' => $rating === null ? null : (int) $rating,
            'studioUrl' => $user?->roleIn($station) === null ? null : SessionHandoff::link(PlatformHost::Studio, '/'.$station->frequency->slug),
            'coverEditUrl' => $user?->canInStation($station, StationPermission::EditProfile)
                ? SessionHandoff::link(PlatformHost::Studio, '/'.$station->frequency->slug.'/perfil#portada')
                : null,
            'shareUrl' => StationLinks::listen($station),
            'reportReasons' => ReportContentRequest::reasonOptions(),
        ];
    }
}
