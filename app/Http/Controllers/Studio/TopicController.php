<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Discovery\Actions\EndTopic;
use App\Domain\Discovery\Actions\PublishTopic;
use App\Domain\Discovery\Hashtags;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\PublishTopicRequest;
use App\Http\Resources\Stations\TopicResource;
use App\Models\CurrentTopic;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Tema y hashtags: "¿Qué está pasando ahora?" and its history. */
class TopicController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function index(Request $request): Response
    {
        $station = $this->current->get();

        return Inertia::render('Studio/Topic', [
            'history' => CurrentTopic::query()
                ->whereNotNull('ended_at')
                ->with(['hashtags', 'author'])
                ->latest('started_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (CurrentTopic $topic) => TopicResource::make($topic)->resolve($request)),
            'current' => $station->current_topic_id === null ? null : TopicResource::make(
                CurrentTopic::query()->with(['hashtags', 'author'])->findOrFail($station->current_topic_id),
            )->resolve($request),
            'suggestions' => $station->hashtags()->pluck('hashtags.name')->all(),
            'limits' => [
                'hashtags' => (int) config('platform.stations.max_topic_hashtags'),
                'hashtag_length' => Hashtags::MAX_LENGTH,
            ],
        ]);
    }

    public function store(PublishTopicRequest $request, PublishTopic $publish): RedirectResponse
    {
        $publish->handle($this->current->get(), $request->user(), $request->title(), $request->hashtags());

        return back()->with('success', 'Tus oyentes ya ven el nuevo tema.');
    }

    public function update(PublishTopicRequest $request, PublishTopic $publish): RedirectResponse
    {
        $publish->handle($this->current->get(), $request->user(), $request->title(), $request->hashtags(), editCurrent: true);

        return back()->with('success', 'Actualizamos el tema actual.');
    }

    public function destroy(Request $request, EndTopic $end): RedirectResponse
    {
        $end->handle($this->current->get(), $request->user());

        return back()->with('success', 'Terminaste el tema. Tu radio ya no muestra un tema en curso.');
    }
}
