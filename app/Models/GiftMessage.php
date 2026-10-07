<?php

namespace App\Models;

use App\Domain\Gifts\Enums\GiftMessageStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The text and/or voice note a listener attached to a gift; the host can play it on air. */
#[Fillable(['gift_transaction_id', 'body', 'voice_path', 'voice_mime', 'voice_duration', 'status', 'played_at', 'played_by'])]
class GiftMessage extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'status' => GiftMessageStatus::class,
            'voice_duration' => 'float',
            'played_at' => 'datetime',
        ];
    }

    public function giftTransaction(): BelongsTo
    {
        return $this->belongsTo(GiftTransaction::class);
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(User::class, 'played_by');
    }
}
