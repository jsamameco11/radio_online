<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A listener the station team silenced in its chat, until a moment or for good. */
#[Fillable(['station_id', 'user_id', 'muted_by', 'until'])]
class ChatMute extends Model
{
    use BelongsToStation;

    protected function casts(): array
    {
        return [
            'until' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function moderator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'muted_by');
    }

    /** Mutes still in force. */
    public function scopeActive(Builder $query): void
    {
        $query->where(fn (Builder $query) => $query->whereNull('until')->orWhere('until', '>', now()));
    }
}
