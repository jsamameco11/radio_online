<?php

namespace App\Models;

use App\Domain\Studio\Enums\TrackKind;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An audio file of a station library: a song, a jingle, an effect, a
 * commercial or a recorded program. Nothing sounds until it is placed on the
 * timeline, chosen for the automatic music or fired from the console.
 */
#[Fillable([
    'station_id', 'kind', 'title', 'artist', 'featured', 'album', 'year', 'file_path', 'mime', 'size_bytes',
    'original_path', 'original_duration', 'edit', 'edit_status', 'edit_error', 'edited_at', 'cover_path',
    'identity', 'identified_at', 'duration', 'rotation', 'duck', 'active',
])]
class Track extends Model
{
    use BelongsToStation, HasUuids;

    /** Co-authors a song credits besides its main author. */
    public const MAX_FEATURED = 4;

    /** Genres a song carries, in order. */
    public const MAX_GENRES = 4;

    protected function casts(): array
    {
        return [
            'kind' => TrackKind::class,
            'featured' => 'array',
            'identity' => 'array',
            'edit' => 'array',
            'year' => 'integer',
            'size_bytes' => 'integer',
            'duration' => 'float',
            'original_duration' => 'float',
            'rotation' => 'boolean',
            'duck' => 'boolean',
            'active' => 'boolean',
            'edited_at' => 'datetime',
            'identified_at' => 'datetime',
            'file_checked_at' => 'datetime',
            'file_problem_at' => 'datetime',
        ];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function playlists(): BelongsToMany
    {
        return $this->belongsToMany(Playlist::class)->withPivot('position');
    }

    public function slots(): HasMany
    {
        return $this->hasMany(ScheduleSlot::class);
    }

    public function episodes(): HasMany
    {
        return $this->hasMany(Episode::class);
    }

    /** The author followed by the co-authors: "Rubén Blades, Willie Colón". */
    public function credit(): ?string
    {
        $names = array_values(array_filter([$this->artist, ...($this->featured ?? [])]));

        return $names ? implode(', ', $names) : null;
    }

    /** The file the editor works from: the original when the audio was already edited. */
    public function sourcePath(): string
    {
        return $this->original_path ?: $this->file_path;
    }

    public function sourceDuration(): float
    {
        return (float) ($this->original_path ? ($this->original_duration ?: $this->duration) : $this->duration);
    }
}
