<?php

namespace App\Domain\Wallet\Exceptions;

/** The idempotency key was already used for a different movement. */
final class IdempotencyConflict extends WalletException
{
    public function __construct(public readonly string $key)
    {
        parent::__construct('Esta operación ya fue registrada con otros datos. Actualiza la página e inténtalo de nuevo.');
    }

    public function reason(): string
    {
        return 'idempotency_conflict';
    }
}
