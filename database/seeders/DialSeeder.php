<?php

namespace Database\Seeders;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Frequencies\FrequencyDial;
use App\Models\Frequency;
use Illuminate\Database\Seeder;

/**
 * Puts the dial on the air: creates the frequencies the configured size asks
 * for. Running it again after raising DIAL_SIZE only adds the new ones.
 */
class DialSeeder extends Seeder
{
    public function run(): void
    {
        $existing = Frequency::query()->pluck('label')->flip();
        $now = now();

        $rows = collect(FrequencyDial::fromConfig()->frequencies((int) config('platform.dial.size')))
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
    }
}
