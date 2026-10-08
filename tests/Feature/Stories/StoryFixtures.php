<?php

namespace Tests\Feature\Stories;

use App\Domain\Stories\Enums\StoryBackground;
use App\Domain\Stories\Enums\StoryKind;
use App\Domain\Stories\Support\VideoProbe;
use App\Models\Station;
use App\Models\StationStory;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Media disks faked, ffprobe replaced and stories stored for the stories tests. */
trait StoryFixtures
{
    protected function fakeMedia(): void
    {
        $this->withoutVite();
        Storage::fake((string) config('filesystems.media.public'));
        Storage::fake((string) config('filesystems.media.private'));
        $this->probeMeasures(null);
    }

    /** ffprobe answers with $seconds; null leaves the server without ffprobe. */
    protected function probeMeasures(?float $seconds, bool $available = false): void
    {
        $this->instance(VideoProbe::class, new class($seconds, $available || $seconds !== null) extends VideoProbe
        {
            public function __construct(private readonly ?float $measured, private readonly bool $installed) {}

            public function available(): bool
            {
                return $this->installed;
            }

            public function seconds(string $path): ?float
            {
                return $this->measured;
            }
        });
    }

    /** @param  array<string, mixed>  $attributes */
    protected function storedStory(Station $station, array $attributes = []): StationStory
    {
        $key = 'stories/'.$station->id.'/2026/10/'.Str::uuid().'.jpg';
        Storage::disk((string) config('filesystems.media.public'))->put($key, 'image');

        return StationStory::query()->forceCreate([
            'station_id' => $station->id,
            'posted_by' => $station->owner_id,
            'kind' => StoryKind::Image,
            'media_key' => $key,
            'duration_ms' => 6000,
            'expires_at' => now()->addDay(),
            ...$attributes,
        ]);
    }

    protected function textStory(Station $station, string $text = 'Hoy a las 8 pm, en vivo.'): StationStory
    {
        return StationStory::query()->forceCreate([
            'station_id' => $station->id,
            'posted_by' => $station->owner_id,
            'kind' => StoryKind::Text,
            'text' => $text,
            'background' => StoryBackground::Royal,
            'duration_ms' => 6000,
            'expires_at' => now()->addDay(),
        ]);
    }
}
