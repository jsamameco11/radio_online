<?php

namespace App\Domain\Studio\Broadcast;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** Nobody stored this factory effect yet: the console renders it and sends it again with its audio. */
final class FactoryEffectMissing extends RuntimeException
{
    public const CODE = 'audio';

    /** Expected the first time any station uses an effect: nothing to log. */
    public function report(): void {}

    public function render(): JsonResponse
    {
        return response()->json(['message' => 'Falta el audio del efecto.', 'code' => self::CODE], 409);
    }
}
