<?php

namespace App\Domain\Wallet\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * A money operation the platform refused for a reason the user can act on.
 * The message is shown as is: JSON callers get a 422, page visits go back
 * with the message flashed as an error.
 */
abstract class WalletException extends RuntimeException
{
    /** Stable identifier the frontend can branch on ("insufficient_balance"…). */
    abstract public function reason(): string;

    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $this->getMessage(), 'reason' => $this->reason()], 422);
        }

        return back()->with('error', $this->getMessage());
    }
}
