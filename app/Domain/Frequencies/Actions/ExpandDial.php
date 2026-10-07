<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Frequencies\FrequencyDial;
use App\Models\Frequency;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Grows the dial to $size frequencies. The dial is nested, so the first
 * frequencies never move: only the missing ones are created, all available.
 */
final class ExpandDial
{
    public function __construct(private readonly AuditTrail $audit) {}

    /** Every frequency the band can hold, one per hundredth of MHz. */
    public static function capacity(): int
    {
        return (int) round((float) config('platform.dial.max') * 100) - (int) round((float) config('platform.dial.min') * 100) + 1;
    }

    /**
     * @return int How many frequencies were created.
     */
    public function handle(int $size, ?User $actor = null): int
    {
        if ($size > self::capacity()) {
            throw ValidationException::withMessages([
                'size' => 'La banda FM admite como máximo '.number_format(self::capacity()).' frecuencias.',
            ]);
        }

        $existing = Frequency::query()->pluck('label')->flip();
        $now = now();

        $rows = collect(FrequencyDial::fromConfig()->frequencies($size))
            ->reject(fn (string $label) => $existing->has($label))
            ->map(fn (string $label) => [
                'frequency' => $label,
                'label' => $label,
                'slug' => FrequencyDial::slug($label),
                'band' => config('platform.dial.band'),
                'status' => FrequencyStatus::Available->value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

        foreach ($rows->chunk(250) as $chunk) {
            Frequency::query()->insert($chunk->values()->all());
        }

        if ($actor !== null) {
            $this->audit->record('dial.expanded', null, ['size' => $size, 'created' => $rows->count()], $actor);
        }

        return $rows->count();
    }
}
