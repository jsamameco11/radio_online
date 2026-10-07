<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Resources\GiftTransactionResource;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Regalos: what the audience sent, totals, top supporters, and the console inbox feed. */
class GiftController extends Controller
{
    private const PERIODS = ['7' => 7, '30' => 30, '90' => 90, 'todo' => null];

    public function index(Request $request, CurrentStation $current): Response
    {
        $station = $current->get();
        $period = array_key_exists((string) $request->query('periodo'), self::PERIODS) ? (string) $request->query('periodo') : '30';
        $since = self::PERIODS[$period] === null ? null : now()->subDays(self::PERIODS[$period]);
        $giftId = $request->integer('regalo') ?: null;
        $withMessage = $request->boolean('con_mensaje');

        $base = GiftTransaction::query()
            ->where('station_id', $station->id)
            ->when($since, fn (Builder $query, Carbon $since) => $query->where('created_at', '>=', $since))
            ->when($giftId, fn (Builder $query, int $giftId) => $query->where('gift_id', $giftId));

        $totals = (clone $base)->toBase()
            ->selectRaw('count(*) as gifts, coalesce(sum(quantity), 0) as units, coalesce(sum(total_cents), 0) as gross, coalesce(sum(station_amount_cents), 0) as earned')
            ->first();

        $supporters = (clone $base)->toBase()
            ->where('anonymous', false)
            ->selectRaw('sender_id, count(*) as gifts, sum(total_cents) as total')
            ->groupBy('sender_id')
            ->orderByDesc('total')
            ->limit(5)
            ->get();
        $names = User::query()->whereKey($supporters->pluck('sender_id'))->pluck('name', 'id');

        $byGift = (clone $base)->toBase()
            ->selectRaw('gift_id, sum(quantity) as units, sum(total_cents) as total')
            ->groupBy('gift_id')
            ->orderByDesc('total')
            ->get();
        $catalog = Gift::query()->orderBy('sort_order')->get(['id', 'name', 'emoji']);

        return Inertia::render('Studio/Gifts/Index', [
            'filters' => ['periodo' => $period, 'regalo' => $giftId, 'con_mensaje' => $withMessage],
            'totals' => [
                'gifts' => (int) $totals->gifts,
                'units' => (int) $totals->units,
                'gross_cents' => (int) $totals->gross,
                'earned_cents' => (int) $totals->earned,
            ],
            'supporters' => $supporters->map(fn (object $row) => [
                'id' => (int) $row->sender_id,
                'name' => $names[$row->sender_id] ?? 'Oyente',
                'gifts' => (int) $row->gifts,
                'total_cents' => (int) $row->total,
            ])->values(),
            'breakdown' => $byGift->map(fn (object $row) => [
                'gift' => $catalog->firstWhere('id', $row->gift_id)?->only(['id', 'name', 'emoji']),
                'units' => (int) $row->units,
                'total_cents' => (int) $row->total,
            ])->values(),
            'catalog' => $catalog->map->only(['id', 'name', 'emoji'])->values(),
            'gifts' => (clone $base)
                ->when($withMessage, fn (Builder $query) => $query->whereHas('message'))
                ->with(['gift', 'sender', 'message.player'])
                ->latest()
                ->orderByDesc('id')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (GiftTransaction $gift) => GiftTransactionResource::make($gift)->resolve($request)),
        ]);
    }

    /** GET /regalos/recientes: the console inbox loads and polls from here. */
    public function recent(Request $request, CurrentStation $current): JsonResponse
    {
        $gifts = GiftTransaction::query()
            ->where('station_id', $current->id())
            ->with(['gift', 'sender', 'message.player'])
            ->latest()
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        return response()->json([
            'gifts' => GiftTransactionResource::collection($gifts)->resolve($request),
        ]);
    }
}
