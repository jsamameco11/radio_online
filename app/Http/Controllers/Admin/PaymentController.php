<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Payments\Actions\RefundPayment;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\RefundPaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** /admin/pagos: every wallet top-up of the platform, with refunds. */
class PaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $status = PaymentStatus::tryFrom((string) $request->query('estado'));
        $search = trim((string) $request->query('buscar'));

        $payments = Payment::query()
            ->with('user')
            ->when($status, fn (Builder $query, PaymentStatus $status) => $query->where('status', $status->value))
            ->when($search !== '', fn (Builder $query) => Str::isUuid($search)
                ? $query->whereKey($search)
                : $query->whereHas('user', fn (Builder $user) => $user->whereLike('email', "%{$search}%")->orWhereLike('name', "%{$search}%")))
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Payment $payment) => PaymentResource::make($payment)->resolve($request));

        $totals = Payment::query()->toBase()
            ->selectRaw('status, count(*) as payments, coalesce(sum(amount_cents), 0) as amount')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        return Inertia::render('Admin/Payments/Index', [
            'filters' => ['estado' => $status?->value, 'buscar' => $search],
            'statuses' => collect(PaymentStatus::cases())->map(fn (PaymentStatus $case) => ['value' => $case->value, 'label' => $case->label()]),
            'totals' => collect(PaymentStatus::cases())->mapWithKeys(fn (PaymentStatus $case) => [$case->value => [
                'payments' => (int) ($totals[$case->value]->payments ?? 0),
                'amount_cents' => (int) ($totals[$case->value]->amount ?? 0),
            ]]),
            'payments' => $payments,
            'canRefund' => $request->user()->can('payments.refund'),
        ]);
    }

    public function refund(RefundPaymentRequest $request, Payment $payment, RefundPayment $refund): RedirectResponse
    {
        $refund->handle($payment, $request->user(), (string) $request->validated('reason'));

        return back()->with('success', 'Reembolsamos la recarga y descontamos el monto de la billetera.');
    }
}
