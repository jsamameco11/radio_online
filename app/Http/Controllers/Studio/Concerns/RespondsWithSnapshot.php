<?php

namespace App\Http\Controllers\Studio\Concerns;

use App\Domain\Studio\Broadcast\StationBroadcast;
use Illuminate\Http\JsonResponse;

/** Console actions answer with what the team is told and the fresh console state. */
trait RespondsWithSnapshot
{
    /**
     * @param  array<string, mixed>  $extra
     */
    protected function snapshot(?string $message = null, array $extra = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'snapshot' => app(StationBroadcast::class)->snapshot(),
            ...$extra,
        ], $status);
    }
}
