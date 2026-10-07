<?php

namespace Database\Factories;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Frequencies\FrequencyDial;
use App\Models\Frequency;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Frequency>
 */
class FrequencyFactory extends Factory
{
    public function definition(): array
    {
        $label = number_format(fake()->unique()->numberBetween(8770, 10790) / 100, 2, '.', '');

        return [
            'frequency' => $label,
            'label' => $label,
            'slug' => FrequencyDial::slug($label),
            'band' => 'FM',
            'status' => FrequencyStatus::Available,
        ];
    }

    public function active(): static
    {
        return $this->state(fn () => ['status' => FrequencyStatus::Active, 'activated_at' => now()]);
    }
}
