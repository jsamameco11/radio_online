<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Discovery\Hashtags;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Episodes\Actions\DeleteEpisode;
use App\Domain\Studio\Episodes\Actions\SaveEpisode;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\AudioUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\EpisodeRequest;
use App\Http\Requests\Studio\EpisodeStatusRequest;
use App\Http\Resources\EpisodeResource;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Episodios: recorded programs listeners play on demand. */
class EpisodeController extends Controller
{
    public function index(Request $request, AudioUploads $uploads): Response
    {
        $status = EpisodeStatus::tryFrom((string) $request->query('estado'));
        $search = trim((string) $request->query('buscar'));
        $counts = Episode::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $audios = Track::query()
            ->where('active', true)
            ->orderByRaw('case kind when ? then 0 when ? then 1 when ? then 2 when ? then 3 else 4 end', [
                TrackKind::Program->value, TrackKind::Song->value, TrackKind::Jingle->value, TrackKind::Commercial->value,
            ])
            ->latest()
            ->get(['id', 'kind', 'title', 'artist', 'featured', 'duration']);
        $prefill = $audios->firstWhere('id', $request->query('audio'));

        return Inertia::render('Studio/Episodes', [
            'episodes' => Episode::query()
                ->with(['track', 'hashtags'])
                ->when($status, fn (Builder $query) => $query->where('status', $status->value))
                ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $match) => $match
                    ->where('title', 'like', "%{$search}%")->orWhere('program', 'like', "%{$search}%")))
                ->orderByDesc('aired_on')->latest()
                ->paginate(20)
                ->withQueryString()
                ->through(fn (Episode $episode) => EpisodeResource::make($episode)->resolve($request)),
            'filters' => ['status' => $status?->value, 'search' => $search],
            'statuses' => collect(EpisodeStatus::cases())->map(fn (EpisodeStatus $case) => ['value' => $case->value, 'label' => $case->label()])->values(),
            'programs' => Episode::query()->whereNotNull('program')->distinct()->orderBy('program')->pluck('program'),
            'stats' => collect(EpisodeStatus::cases())->mapWithKeys(fn (EpisodeStatus $case) => [$case->value => (int) ($counts[$case->value] ?? 0)]),
            'audios' => $audios->map(fn (Track $track) => [
                'id' => $track->id,
                'title' => $track->title,
                'artist' => $track->credit(),
                'kind' => $track->kind->value,
                'duration' => (float) $track->duration,
            ])->values(),
            'kinds' => collect([TrackKind::Program, TrackKind::Song, TrackKind::Jingle, TrackKind::Commercial, TrackKind::Effect])
                ->map(fn (TrackKind $kind) => ['value' => $kind->value, 'label' => $kind->label()]),
            'prefill' => $prefill?->id,
            'recordings' => Recording::query()
                ->where('status', RecordingStatus::Ready->value)
                ->latest('started_at')
                ->get(['id', 'duration', 'started_at'])
                ->map(fn (Recording $recording) => [
                    'id' => $recording->id,
                    'duration' => (float) $recording->duration,
                    'started_at' => $recording->started_at?->toIso8601String(),
                ]),
            'limits' => [
                'direct' => $uploads->direct(),
                'max_mb' => $uploads->maxMegabytes(),
                'max_cover_mb' => (int) config('platform.media.max_cover_mb'),
                'max_duration' => AudioFile::maxDuration(),
                'max_hashtags' => (int) config('platform.media.max_episode_hashtags'),
                'hashtag_length' => Hashtags::MAX_LENGTH,
                'max_description' => EpisodeRequest::MAX_DESCRIPTION,
                'types' => AudioFile::TYPES,
            ],
        ]);
    }

    public function store(EpisodeRequest $request, SaveEpisode $save): JsonResponse
    {
        $episode = $save->handle($request->user(), $request->validated(), $request->file('audio'), $request->file('cover'));

        return response()->json(['episode' => EpisodeResource::make($episode)->resolve($request)], 201);
    }

    public function update(EpisodeRequest $request, string $episode, SaveEpisode $save): JsonResponse
    {
        $saved = $save->handle($request->user(), $request->validated(), $request->file('audio'), $request->file('cover'), $this->find($episode));

        return response()->json(['episode' => EpisodeResource::make($saved)->resolve($request)]);
    }

    public function status(EpisodeStatusRequest $request, string $episode): RedirectResponse
    {
        $found = $this->find($episode);
        $status = EpisodeStatus::from($request->validated('status'));
        $publishAt = $request->validated('publish_at');
        SaveEpisode::applyStatus($found, $status, $publishAt ? Carbon::parse($publishAt) : null);
        $found->save();

        return back()->with('success', match ($status) {
            EpisodeStatus::Published => "Publicamos «{$found->title}».",
            EpisodeStatus::Scheduled => "«{$found->title}» se publicará el {$found->publish_at?->timezone(config('app.timezone'))->format('d/m/Y H:i')}.",
            EpisodeStatus::Archived => "Archivamos «{$found->title}».",
            EpisodeStatus::Draft => "«{$found->title}» volvió a borrador.",
        });
    }

    public function destroy(string $episode, DeleteEpisode $delete): RedirectResponse
    {
        $found = $this->find($episode);
        $delete->handle($found);

        return back()->with('success', "Eliminamos el episodio «{$found->title}».");
    }

    private function find(string $id): Episode
    {
        return Episode::query()->with(['track', 'hashtags'])->findOrFail($id);
    }
}
