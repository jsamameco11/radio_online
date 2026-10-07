<?php

namespace App\Domain\Wallet\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * What a ledger movement is about: its idempotency key, the text the owner
 * reads in their history, the record that caused it and who triggered it.
 */
final readonly class LedgerEntry
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public string $idempotencyKey,
        public ?string $description = null,
        public ?Model $source = null,
        public ?User $actor = null,
        public array $meta = [],
    ) {}
}
