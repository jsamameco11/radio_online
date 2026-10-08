<?php

namespace Database\Factories;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Station>
 */
class StationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'frequency_id' => Frequency::factory()->active(),
            'owner_id' => User::factory(),
            'name' => 'Radio '.fake()->unique()->firstName(),
            'tagline' => fake()->sentence(5),
            'description' => fake()->sentences(5, true),
            'status' => StationStatus::Active,
            'visibility' => StationVisibility::Public,
            'stream_status' => StreamStatus::Offline,
        ];
    }

    /** Adds the owner to the station team, as App\Domain\Stations\Actions\OpenStation does. */
    public function configure(): static
    {
        return $this->afterCreating(function (Station $station) {
            $station->members()->firstOrCreate(['user_id' => $station->owner_id], ['role' => StationRole::Owner]);
        });
    }

    public function live(): static
    {
        return $this->state(fn () => ['stream_status' => StreamStatus::Live, 'went_live_at' => now(), 'last_heartbeat_at' => now()]);
    }

    public function suspended(): static
    {
        return $this->state(fn () => ['status' => StationStatus::Suspended, 'suspended_at' => now()]);
    }
}
