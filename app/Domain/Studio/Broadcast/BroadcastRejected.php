<?php

namespace App\Domain\Studio\Broadcast;

use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/** A change the console or the schedule cannot make now. The message is shown to the team as it is. */
final class BroadcastRejected extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public function render(Request $request): Response
    {
        if ($request->header('X-Inertia')) {
            return back()->with('error', $this->getMessage());
        }

        return response()->json(['message' => $this->getMessage()], $this->status);
    }
}
