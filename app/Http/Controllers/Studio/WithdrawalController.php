<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Monetization\Actions\RequestWithdrawal;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Monetization\RequestWithdrawalRequest;
use Illuminate\Http\RedirectResponse;

/** Estudio > Monetización > Retirar ganancias. */
class WithdrawalController extends Controller
{
    public function store(RequestWithdrawalRequest $request, CurrentStation $current, RequestWithdrawal $action): RedirectResponse
    {
        $withdrawal = $action->handle(
            $current->get(),
            $request->user(),
            $request->integer('amount_cents'),
            PayoutMethod::from((string) $request->validated('payout_method')),
            $request->details(),
        );

        return back()->with('success', "Recibimos tu retiro de {$withdrawal->formattedAmount()}. Te avisaremos cuando lo enviemos.");
    }
}
