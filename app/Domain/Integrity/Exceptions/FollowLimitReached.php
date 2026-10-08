<?php

namespace App\Domain\Integrity\Exceptions;

use RuntimeException;

/** An account subscribed to too many stations in a short time (config('platform.integrity.follows_per_*')). */
final class FollowLimitReached extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Te suscribiste a muchas radios en poco tiempo. Espera un rato e inténtalo de nuevo.');
    }
}
