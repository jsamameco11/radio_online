<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Editor\AudioEditor;
use App\Domain\Studio\Editor\EditRecipe;
use App\Domain\Studio\Editor\EditStatus;
use App\Domain\Studio\Editor\FilterGraph;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\StudioAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\EditorRecipeRequest;
use App\Jobs\RenderAudioEdit;
use App\Models\Track;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Studio › Editor de audio: cuts, fades and sound treatment of a library audio, previewed live
 * in the browser and rendered by the server (RenderAudioEdit). Members who only manage episodes
 * edit recorded programs only.
 */
class EditorController extends Controller
{
    public function __construct(
        private readonly StudioAccess $access,
        private readonly AudioEditor $editor,
        private readonly MediaStorage $storage,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $search = trim((string) $request->query('buscar'));
        $kind = TrackKind::tryFrom((string) $request->query('tipo'));
        $selected = $request->query('audio');
        $track = is_string($selected) && Str::isUuid($selected) ? $this->editable($user)->find($selected) : null;
        $counts = $this->editable($user)->toBase()->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');

        return Inertia::render('Studio/Editor', [
            'available' => $this->editor->available(),
            'tracks' => $this->editable($user)
                ->when($kind, fn (Builder $query) => $query->where('kind', $kind->value))
                ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $match) => $match
                    ->where('title', 'like', "%{$search}%")->orWhere('artist', 'like', "%{$search}%")))
                ->latest('updated_at')
                ->limit(100)
                ->get()
                ->map(fn (Track $item) => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'credit' => $item->credit(),
                    'kind' => $item->kind->value,
                    'kind_label' => $item->kind->label(),
                    'cover_url' => $this->storage->url($item->cover_path),
                    'duration' => (float) $item->duration,
                    'edited' => $item->original_path !== null,
                    'edit_status' => $item->edit_status,
                ]),
            'kinds' => collect(TrackKind::cases())
                ->filter(fn (TrackKind $case) => isset($counts[$case->value]))
                ->map(fn (TrackKind $case) => ['value' => $case->value, 'label' => $case->label(), 'count' => (int) $counts[$case->value]])
                ->values(),
            'total' => (int) $counts->sum(),
            'track' => $track ? $this->detail($this->settle($track)) : null,
            'search' => $search,
            'kind' => $kind?->value,
            'limits' => [
                'max_cuts' => EditRecipe::MAX_CUTS,
                'min_length' => EditRecipe::MIN_LENGTH,
                'max_fade' => EditRecipe::MAX_FADE,
                'max_join' => EditRecipe::MAX_JOIN,
                'max_gain' => EditRecipe::MAX_GAIN,
                'preview_seconds' => AudioEditor::PREVIEW_SECONDS,
                'target_lufs' => FilterGraph::TARGET_LUFS,
            ],
        ]);
    }

    public function analysis(Request $request, string $track): JsonResponse
    {
        return response()->json(['analysis' => $this->editor->analysis($this->find($request->user(), $track))]);
    }

    public function store(EditorRecipeRequest $request, string $track, CurrentStation $current): JsonResponse
    {
        $found = $this->find($request->user(), $track);
        if (! $this->editor->available()) {
            return response()->json(['message' => AudioEditor::UNAVAILABLE], 503);
        }
        if ($found->edit_status === EditStatus::Processing->value && ! $this->editor->isStale($found)) {
            return response()->json(['message' => 'Este audio ya se está procesando. Espera a que termine.'], 409);
        }
        $recipe = EditRecipe::from($request->validated('recipe'), $found->sourceDuration());
        if ($recipe === null) {
            return $this->invalid('La edición dejaría el audio vacío o con demasiados cortes.');
        }
        if (EditRecipe::isPlain($recipe)) {
            return $this->invalid($found->original_path !== null
                ? 'Así quedaría igual al original. Para volver al original usa «Restaurar original».'
                : 'Todavía no hiciste ningún cambio en este audio.');
        }

        $found->forceFill(['edit_status' => EditStatus::Processing->value, 'edit_error' => null])->save();
        RenderAudioEdit::dispatch((int) $current->id(), $found->id, $recipe);

        return response()->json(['track' => $this->detail($found->refresh())], 202);
    }

    public function status(Request $request, string $track): JsonResponse
    {
        return response()->json(['track' => $this->detail($this->settle($this->find($request->user(), $track)))]);
    }

    public function preview(EditorRecipeRequest $request, string $track): BinaryFileResponse|JsonResponse
    {
        $found = $this->find($request->user(), $track);
        if (! $this->editor->available()) {
            return response()->json(['message' => AudioEditor::UNAVAILABLE], 503);
        }
        $recipe = EditRecipe::from($request->validated('recipe'), $found->sourceDuration());
        if ($recipe === null) {
            return response()->json(['message' => 'La edición dejaría el audio vacío.'], 422);
        }
        try {
            $file = $this->editor->preview($found, $recipe, (float) $request->validated('at', 0));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->file($file, ['Content-Type' => 'audio/mpeg', 'Cache-Control' => 'no-store'])->deleteFileAfterSend();
    }

    public function restore(Request $request, string $track): JsonResponse
    {
        $found = $this->find($request->user(), $track);
        if ($found->edit_status === EditStatus::Processing->value && ! $this->editor->isStale($found)) {
            return response()->json(['message' => 'Espera a que termine el procesamiento antes de restaurar el original.'], 409);
        }
        if ($found->original_path === null) {
            return response()->json(['message' => 'Este audio no tiene ediciones: ya es el original.'], 422);
        }
        $this->editor->restore($found);

        return response()->json(['track' => $this->detail($found->refresh())]);
    }

    private function invalid(string $message): JsonResponse
    {
        return response()->json(['message' => $message, 'errors' => ['recipe' => [$message]]], 422);
    }

    /** An edit cut off midway is reported as failed instead of processing forever. */
    private function settle(Track $track): Track
    {
        if ($this->editor->isStale($track)) {
            $track->forceFill(['edit_status' => EditStatus::Failed->value, 'edit_error' => 'El procesamiento se interrumpió. Inténtalo de nuevo.'])->save();
        }

        return $track;
    }

    /** @return array<string, mixed> */
    private function detail(Track $track): array
    {
        $track->loadCount(['episodes', 'slots as upcoming_count' => fn (Builder $query) => $query->where('starts_at', '>=', now())]);

        return [
            'id' => $track->id,
            'title' => $track->title,
            'credit' => $track->credit(),
            'kind' => $track->kind->value,
            'kind_label' => $track->kind->label(),
            'duration' => (float) $track->duration,
            'source_duration' => $track->sourceDuration(),
            'source_url' => $this->storage->url($track->sourcePath()),
            'audio_url' => $this->storage->url($track->file_path),
            'cover_url' => $this->storage->url($track->cover_path),
            'edited' => $track->original_path !== null,
            'edit' => $track->edit,
            'edit_status' => $track->edit_status,
            'edit_error' => $track->edit_error,
            'edited_at' => $track->edited_at?->toIso8601String(),
            'upcoming' => (int) $track->getAttribute('upcoming_count'),
            'episodes' => (int) $track->getAttribute('episodes_count'),
        ];
    }

    /** @return Builder<Track> */
    private function editable(User $user): Builder
    {
        return Track::query()->when(
            ! $this->access->allows($user, StationPermission::ManageLibrary),
            fn (Builder $query) => $query->where('kind', TrackKind::Program->value),
        );
    }

    private function find(User $user, string $id): Track
    {
        return $this->editable($user)->findOrFail($id);
    }
}
