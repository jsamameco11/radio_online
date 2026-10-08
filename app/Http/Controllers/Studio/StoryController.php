<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stories\Actions\DeleteStory;
use App\Domain\Stories\Actions\PostStory;
use App\Domain\Stories\Support\StoryLimits;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stories\StoryRequest;
use App\Http\Resources\Studio\StoryResource;
use App\Models\StationStory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Estados: photos, videos and texts the station shares for 24 hours. */
class StoryController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Studio/Stories', [
            'stories' => StoryResource::collection(StationStory::query()->active()->with('author')->latest()->latest('id')->get())->resolve($request),
            'limits' => StoryLimits::forComposer(),
        ]);
    }

    public function store(StoryRequest $request, PostStory $post): JsonResponse
    {
        $story = $post->handle($request->user(), $request->validated(), $request->file('media'), $request->file('poster'));

        return response()->json(['story' => StoryResource::make($story->load('author'))->resolve($request)], 201);
    }

    public function destroy(string $story, DeleteStory $delete): RedirectResponse
    {
        $delete->handle(StationStory::query()->findOrFail($story));

        return back()->with('success', 'Eliminamos el estado.');
    }
}
