<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Resources\WalletTransactionResource;
use App\Models\GiftTransaction;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Finanzas: the station wallet, what gifts earned day by day, and every movement. */
class FinanceController extends Controller
{
    private const DAYS = 30;

    public function __invoke(Request $request, CurrentStation $current, WalletLedger $ledger): Response
    {
        $station = $current->get();
        $wallet = $ledger->open($station);
        $timezone = (string) config('platform.timezone');
        $appTimezone = (string) config('app.timezone');
        $today = now($timezone)->startOfDay();
        $from = $today->copy()->subDays(self::DAYS - 1);

        $gifts = GiftTransaction::query()->where('station_id', $station->id);

        $lifetime = (clone $gifts)->toBase()
            ->selectRaw('count(*) as gifts, coalesce(sum(station_amount_cents), 0) as earned, coalesce(sum(platform_fee_cents), 0) as fees')
            ->first();

        $month = (int) (clone $gifts)->where('created_at', '>=', $today->copy()->startOfMonth()->setTimezone($appTimezone))->sum('station_amount_cents');

        $daily = (clone $gifts)->toBase()
            ->where('created_at', '>=', $from->copy()->setTimezone($appTimezone))
            ->get(['created_at', 'station_amount_cents', 'quantity'])
            ->groupBy(fn (object $row) => Carbon::parse($row->created_at, $appTimezone)->setTimezone($timezone)->toDateString());

        $series = collect(range(0, self::DAYS - 1))->map(function (int $offset) use ($from, $daily) {
            $day = $from->copy()->addDays($offset)->toDateString();
            $rows = $daily->get($day, collect());

            return [
                'date' => $day,
                'earned_cents' => (int) $rows->sum('station_amount_cents'),
                'gifts' => $rows->count(),
            ];
        });

        return Inertia::render('Studio/Gifts/Finances', [
            'wallet' => ['balance_cents' => $wallet->balance_cents, 'currency' => $wallet->currency, 'status' => $wallet->status->label()],
            'summary' => [
                'lifetime_earned_cents' => (int) $lifetime->earned,
                'lifetime_fees_cents' => (int) $lifetime->fees,
                'lifetime_gifts' => (int) $lifetime->gifts,
                'month_earned_cents' => $month,
                'fee_percent' => (int) config('platform.wallet.platform_fee_percent'),
            ],
            'series' => $series,
            'transactions' => $wallet->transactions()
                ->paginate(15)
                ->withQueryString()
                ->through(fn (WalletTransaction $transaction) => WalletTransactionResource::make($transaction)->resolve($request)),
        ]);
    }
}
