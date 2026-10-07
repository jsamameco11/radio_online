<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\AdjustWalletRequest;
use App\Http\Resources\WalletTransactionResource;
use App\Models\GiftTransaction;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/** /admin/movimientos: the platform ledger, across every wallet, and manual adjustments. */
class LedgerController extends Controller
{
    public function index(Request $request): Response
    {
        $type = WalletTransactionType::tryFrom((string) $request->query('tipo'));
        $owner = in_array($request->query('titular'), ['user', 'station'], true) ? (string) $request->query('titular') : null;
        $search = trim((string) $request->query('buscar'));
        $from = $this->date($request->query('desde'));
        $to = $this->date($request->query('hasta'), endOfDay: true);

        $transactions = WalletTransaction::query()
            ->with(['actor', 'wallet.owner' => fn (MorphTo $morph) => $morph->morphWith([Station::class => ['frequency']])])
            ->when($type, fn (Builder $query, WalletTransactionType $type) => $query->where('type', $type->value))
            ->when($owner, fn (Builder $query, string $owner) => $query->whereHas('wallet', fn (Builder $wallet) => $wallet->where('owner_type', $owner)))
            ->when($search !== '', fn (Builder $query) => $this->search($query, $search))
            ->when($from, fn (Builder $query, Carbon $from) => $query->where('created_at', '>=', $from))
            ->when($to, fn (Builder $query, Carbon $to) => $query->where('created_at', '<=', $to))
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (WalletTransaction $transaction) => WalletTransactionResource::make($transaction)->resolve($request));

        return Inertia::render('Admin/Ledger/Index', [
            'filters' => [
                'tipo' => $type?->value,
                'titular' => $owner,
                'buscar' => $search,
                'desde' => $from === null ? null : $request->query('desde'),
                'hasta' => $to === null ? null : $request->query('hasta'),
            ],
            'types' => collect(WalletTransactionType::cases())->map(fn (WalletTransactionType $case) => ['value' => $case->value, 'label' => $case->label()]),
            'summary' => [
                'listener_balances_cents' => (int) Wallet::query()->where('owner_type', 'user')->sum('balance_cents'),
                'station_balances_cents' => (int) Wallet::query()->where('owner_type', 'station')->sum('balance_cents'),
                'platform_fees_cents' => (int) GiftTransaction::query()->sum('platform_fee_cents'),
                'deposits_cents' => (int) WalletTransaction::query()->where('type', WalletTransactionType::Deposit->value)->sum('amount_cents'),
            ],
            'transactions' => $transactions,
            'canAdjust' => $request->user()->can('wallets.adjust'),
        ]);
    }

    public function adjust(AdjustWalletRequest $request, WalletLedger $ledger): RedirectResponse
    {
        $wallet = $ledger->open($request->walletOwner());

        $ledger->adjust(
            $wallet,
            $request->integer('amount_cents'),
            trim((string) $request->validated('reason')),
            $request->user(),
            'adjust:'.$request->validated('idempotency_key'),
        );

        return back()->with('success', 'Registramos el ajuste en la billetera.');
    }

    /**
     * @param  Builder<WalletTransaction>  $query
     */
    private function search(Builder $query, string $search): void
    {
        $users = User::query()->whereLike('email', "%{$search}%")->orWhereLike('name', "%{$search}%")->limit(200)->pluck('id');
        $stations = Station::query()
            ->whereLike('name', "%{$search}%")
            ->orWhereHas('frequency', fn (Builder $frequency) => $frequency->whereLike('label', "%{$search}%"))
            ->limit(200)
            ->pluck('id');

        $query->whereHas('wallet', fn (Builder $wallet) => $wallet
            ->where(fn (Builder $byUser) => $byUser->where('owner_type', 'user')->whereIn('owner_id', $users))
            ->orWhere(fn (Builder $byStation) => $byStation->where('owner_type', 'station')->whereIn('owner_id', $stations)));
    }

    /** A "YYYY-MM-DD" filter read in the platform timezone, as a database timestamp. */
    private function date(mixed $value, bool $endOfDay = false): ?Carbon
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        $date = Carbon::createFromFormat('Y-m-d', $value, (string) config('platform.timezone'));
        if ($date === null) {
            return null;
        }

        return ($endOfDay ? $date->endOfDay() : $date->startOfDay())->setTimezone((string) config('app.timezone'));
    }
}
