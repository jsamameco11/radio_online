<?php

namespace App\Models;

use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Streaming\Enums\StreamStatus;
use Database\Factories\StationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A radio station of the platform, always shown together with its
 * frequency: "89.30 · Radio Aurora".
 */
#[Fillable([
    'frequency_id', 'owner_id', 'name', 'tagline', 'description', 'logo_path', 'cover_path', 'accent_color',
    'language', 'country', 'status', 'visibility', 'stream_status', 'external_stream_url', 'current_topic_id',
    'listener_count', 'peak_listener_count', 'follower_count', 'last_heartbeat_at', 'latency_ms', 'bitrate_kbps',
    'went_live_at', 'suspended_at', 'suspension_reason',
])]
class Station extends Model
{
    /** @use HasFactory<StationFactory> */
    use HasFactory, SoftDeletes;

    protected $attributes = [
        'status' => 'active',
        'visibility' => 'public',
        'stream_status' => 'offline',
        'listener_count' => 0,
        'peak_listener_count' => 0,
        'follower_count' => 0,
        'rating_count' => 0,
        'rating_average' => 0,
    ];

    protected function casts(): array
    {
        return [
            'status' => StationStatus::class,
            'visibility' => StationVisibility::class,
            'stream_status' => StreamStatus::class,
            'listener_count' => 'integer',
            'peak_listener_count' => 'integer',
            'follower_count' => 'integer',
            'rating_count' => 'integer',
            'rating_average' => 'float',
            'latency_ms' => 'integer',
            'bitrate_kbps' => 'integer',
            'last_heartbeat_at' => 'datetime',
            'went_live_at' => 'datetime',
            'suspended_at' => 'datetime',
            'monetized_at' => 'datetime',
        ];
    }

    public function frequency(): BelongsTo
    {
        return $this->belongsTo(Frequency::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(StationMember::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function hashtags(): BelongsToMany
    {
        return $this->belongsToMany(Hashtag::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function currentTopic(): BelongsTo
    {
        return $this->belongsTo(CurrentTopic::class);
    }

    public function topics(): HasMany
    {
        return $this->hasMany(CurrentTopic::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(StationRating::class);
    }

    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'follows')
            ->withPivot('created_at');
    }

    public function settings(): HasMany
    {
        return $this->hasMany(StationSetting::class);
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class);
    }

    public function playlists(): HasMany
    {
        return $this->hasMany(Playlist::class);
    }

    public function episodes(): HasMany
    {
        return $this->hasMany(Episode::class);
    }

    public function listenerSessions(): HasMany
    {
        return $this->hasMany(ListenerSession::class);
    }

    public function streamSessions(): HasMany
    {
        return $this->hasMany(StreamSession::class);
    }

    public function giftTransactions(): HasMany
    {
        return $this->hasMany(GiftTransaction::class);
    }

    public function wallet(): MorphOne
    {
        return $this->morphOne(Wallet::class, 'owner');
    }

    /** "89.30 · Radio Aurora" */
    public function displayName(): string
    {
        return $this->frequency->display().' · '.$this->name;
    }

    public function isOnAir(): bool
    {
        return $this->stream_status->isAudible();
    }

    /** The required description is written and long enough to tell listeners what the station is about. */
    public function hasDescription(): bool
    {
        return mb_strlen(trim((string) $this->description)) >= (int) config('platform.stations.description_min');
    }

    /** A "Radio monetizada": the platform approved its monetization request. */
    public function isMonetized(): bool
    {
        return $this->monetized_at !== null;
    }

    /** Stations anyone can find: active and public. */
    public function scopeDiscoverable(Builder $query): void
    {
        $query->where('status', StationStatus::Active->value)
            ->where('visibility', StationVisibility::Public->value);
    }

    public function scopeOnAir(Builder $query): void
    {
        $query->whereIn('stream_status', [StreamStatus::Live->value, StreamStatus::Online->value]);
    }
}
