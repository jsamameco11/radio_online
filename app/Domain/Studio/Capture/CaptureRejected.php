<?php

namespace App\Domain\Studio\Capture;

use App\Models\Recording;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The live recording cannot take what the console sent. The message is shown to the operator;
 * "code" tells the recorder what to do (gap: resend from the missing piece, full: stop sending).
 */
final class CaptureRejected extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 422,
        public readonly ?Recording $recording = null,
        public readonly ?string $reason = null,
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $this->getMessage(),
            'code' => $this->reason,
            'recording' => $this->recording ? LiveCapture::brief($this->recording) : null,
        ], fn ($value) => $value !== null), $this->status);
    }
}
