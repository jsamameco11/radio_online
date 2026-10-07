<?php

namespace App\Domain\Studio\Library;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An audio the library cannot keep. The message is shown to the team as it
 * is; "again" tells the browser its upload is gone and the file must be sent anew.
 */
final class AudioRejected extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => ['audio' => [$this->getMessage()]],
            'again' => $this->status === 410,
        ], $this->status);
    }
}
