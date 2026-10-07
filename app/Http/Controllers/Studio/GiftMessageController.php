<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Gifts\Actions\ChangeMessageVisibility;
use App\Domain\Gifts\Actions\MarkMessagePlayed;
use App\Domain\Gifts\Actions\ReportGiftMessage;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gifts\MessageVisibilityRequest;
use App\Http\Requests\Gifts\ReportGiftMessageRequest;
use App\Http\Resources\GiftTransactionResource;
use App\Models\GiftMessage;
use App\Models\GiftTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Mensajes: the text and voice notes listeners attached to their gifts. */
class GiftMessageController extends Controller
{
    private const TABS = ['pendientes', 'escuchados', 'ocultos', 'todos'];

    public function __construct(private readonly CurrentStation $current) {}

    public function index(Request $request): Response
    {
        $tab = in_array($request->query('estado'), self::TABS, true) ? (string) $request->query('estado') : 'pendientes';

        $counts = collect(self::TABS)->mapWithKeys(fn (string $name) => [
            $name => $this->withMessages($name)->count(),
        ]);

        return Inertia::render('Studio/Gifts/Messages', [
            'tab' => $tab,
            'counts' => $counts,
            'reasons' => collect(ReportReason::cases())->map(fn (ReportReason $reason) => ['value' => $reason->value, 'label' => $reason->label()]),
            'gifts' => $this->withMessages($tab)
                ->with(['gift', 'sender', 'message.player'])
                ->latest()
                ->orderByDesc('id')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (GiftTransaction $gift) => GiftTransactionResource::make($gift)->resolve($request)),
        ]);
    }

    /** Redirects to a short-lived signed URL of the private voice file. */
    public function audio(string $message, MediaStorage $storage): RedirectResponse
    {
        $found = $this->find($message);
        abort_if($found->voice_path === null, 404);

        return redirect()->away((string) $storage->url($found->voice_path, now()->addMinutes(10)));
    }

    public function played(Request $request, string $message, MarkMessagePlayed $markPlayed): JsonResponse
    {
        $found = $markPlayed->handle($this->find($message), $request->user(), (int) $this->current->id());
        $found->load('player');

        return response()->json([
            'played_at' => $found->played_at?->toIso8601String(),
            'played_by' => $found->player?->name,
        ]);
    }

    public function visibility(MessageVisibilityRequest $request, string $message, ChangeMessageVisibility $change): RedirectResponse
    {
        $visible = $request->boolean('visible');
        $change->handle($this->find($message), $visible, $request->user(), $this->current->get());

        return back()->with('success', $visible ? 'El mensaje vuelve a estar visible.' : 'Ocultamos el mensaje.');
    }

    public function report(ReportGiftMessageRequest $request, string $message, ReportGiftMessage $report): RedirectResponse
    {
        $report->handle(
            $this->find($message),
            $request->user(),
            $this->current->get(),
            ReportReason::from((string) $request->validated('reason')),
            $request->validated('details'),
        );

        return back()->with('success', 'Reportamos el mensaje al equipo de moderación.');
    }

    /**
     * Gifts of the current station that carry a message, filtered by tab.
     *
     * @return Builder<GiftTransaction>
     */
    private function withMessages(string $tab): Builder
    {
        return GiftTransaction::query()
            ->where('station_id', $this->current->id())
            ->whereHas('message', fn (Builder $query) => match ($tab) {
                'pendientes' => $query->where('status', GiftMessageStatus::Visible->value)->whereNull('played_at'),
                'escuchados' => $query->where('status', GiftMessageStatus::Visible->value)->whereNotNull('played_at'),
                'ocultos' => $query->whereIn('status', [GiftMessageStatus::Hidden->value, GiftMessageStatus::Reported->value]),
                default => $query,
            });
    }

    /** A message of the current station only; any other id is a 404. */
    private function find(string $id): GiftMessage
    {
        abort_unless(Str::isUuid($id), 404);

        return GiftMessage::query()
            ->whereHas('giftTransaction', fn (Builder $query) => $query->where('station_id', $this->current->id()))
            ->findOrFail($id);
    }
}
