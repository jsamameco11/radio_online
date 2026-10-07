<?php

namespace App\Models;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Enums\ChatMessageStatus;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A message of a station's live chat. Listener messages carry their author
 * in user_id; station replies have no user_id and keep the team member who
 * wrote them in sent_by. A highlighted message keeps what it cost and the
 * two ledger rows that paid for it.
 */
#[Fillable([
    'station_id', 'stream_session_id', 'user_id', 'sent_by', 'author', 'reply_to_id', 'body', 'status',
    'highlight_cents', 'processor_fee_cents', 'platform_fee_cents', 'station_amount_cents', 'pinned_until',
    'debit_transaction_id', 'credit_transaction_id', 'idempotency_key', 'hidden_by', 'hidden_at',
])]
class ChatMessage extends Model
{
    use BelongsToStation, HasUuids;

    protected $attributes = [
        'status' => 'visible',
        'highlight_cents' => 0,
        'processor_fee_cents' => 0,
        'platform_fee_cents' => 0,
        'station_amount_cents' => 0,
    ];

    protected function casts(): array
    {
        return [
            'author' => ChatAuthor::class,
            'status' => ChatMessageStatus::class,
            'highlight_cents' => 'integer',
            'processor_fee_cents' => 'integer',
            'platform_fee_cents' => 'integer',
            'station_amount_cents' => 'integer',
            'pinned_until' => 'datetime',
            'hidden_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_id');
    }

    public function streamSession(): BelongsTo
    {
        return $this->belongsTo(StreamSession::class);
    }

    public function hider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hidden_by');
    }

    public function debit(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class, 'debit_transaction_id');
    }

    public function credit(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class, 'credit_transaction_id');
    }

    public function isHighlighted(): bool
    {
        return $this->highlight_cents > 0;
    }

    public function isVisible(): bool
    {
        return $this->status === ChatMessageStatus::Visible;
    }

    public function scopeVisible(Builder $query): void
    {
        $query->where('status', ChatMessageStatus::Visible->value);
    }

    /** Highlighted messages still pinned at the top of the chat. */
    public function scopePinned(Builder $query): void
    {
        $query->where('pinned_until', '>', now());
    }
}
