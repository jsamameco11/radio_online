<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Resources\WalletTransactionResource;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Studio › Finanzas: the station wallet, what its audience added day by day
 * (gifts and highlighted chat messages) and every movement. The station only
 * sees what was credited to it.
 */
class FinanceController extends Controller
{
    private const DAYS = 30;

    private const EARNINGS = [WalletTransactionType::GiftEarning, WalletTransactionType::HighlightEarning];

    public function __invoke(Request $request, CurrentStation $current, WalletLedger $ledger): Response
    {
        $station = $current->get();
        $wallet = $ledger->open($station);
        $timezone = (string) config('platform.timezone');
        $appTimezone = (string) config('app.timezone');
        $today = now($timezone)->startOfDay();
        $from = $today->copy()->subDays(self::DAYS - 1);

        $earnings = WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->whereIn('type', array_map(fn (WalletTransactionType $type) => $type->value, self::EARNINGS));

        $lifetime = (clone $earnings)->toBase()
            ->selectRaw('count(*) as supports, coalesce(sum(amount_cents), 0) as earned')
            ->first();

        $month = (int) (clone $earnings)->where('created_at', '>=', $today->copy()->startOfMonth()->setTimezone($appTimezone))->sum('amount_cents');

        $daily = (clone $earnings)->toBase()
            ->where('created_at', '>=', $from->copy()->setTimezone($appTimezone))
            ->get(['created_at', 'amount_cents'])
            ->groupBy(fn (object $row) => Carbon::parse($row->created_at, $appTimezone)->setTimezone($timezone)->toDateString());

        $series = collect(range(0, self::DAYS - 1))->map(function (int $offset) use ($from, $daily) {
            $day = $from->copy()->addDays($offset)->toDateString();
            $rows = $daily->get($day, collect());

            return [
                'date' => $day,
                'earned_cents' => (int) $rows->sum('amount_cents'),
                'supports' => $rows->count(),
            ];
        });

        return Inertia::render('Studio/Gifts/Finances', [
            'wallet' => ['balance_cents' => $wallet->balance_cents, 'currency' => $wallet->currency, 'status' => $wallet->status->label()],
            'summary' => [
                'lifetime_earned_cents' => (int) $lifetime->earned,
                'lifetime_supports' => (int) $lifetime->supports,
                'month_earned_cents' => $month,
                'min_withdrawal_cents' => (int) config('platform.monetization.min_withdrawal_cents'),
            ],
            'series' => $series,
            'transactions' => $wallet->transactions()
                ->paginate(15)
                ->withQueryString()
                ->through(fn (WalletTransaction $transaction) => WalletTransactionResource::make($transaction)->resolve($request)),
        ]);
    }
}
