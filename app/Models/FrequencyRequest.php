<?php

namespace App\Models;

use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** A user asking the platform for a frequency to open a station on it. */
#[Fillable(['kind', 'user_id', 'frequency_id', 'station_name', 'pitch', 'category_ids', 'status', 'reviewed_by', 'reviewed_at', 'review_note', 'station_id'])]
class FrequencyRequest extends Model
{
    protected $attributes = [
        'kind' => 'new_station',
    ];

    protected function casts(): array
    {
        return [
            'kind' => FrequencyRequestKind::class,
            'category_ids' => 'array',
            'status' => FrequencyRequestStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function frequency(): BelongsTo
    {
        return $this->belongsTo(Frequency::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    /** The applicant's dossier, for "Crear mi radio" requests sent with the full form. */
    public function application(): HasOne
    {
        return $this->hasOne(StationApplication::class);
    }
}
