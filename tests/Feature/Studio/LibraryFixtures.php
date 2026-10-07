<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Media disks faked and library audios stored for the studio media tests. */
trait LibraryFixtures
{
    protected function fakeMedia(): void
    {
        $this->withoutVite();
        Storage::fake((string) config('filesystems.media.public'));
        Storage::fake((string) config('filesystems.media.private'));
        config(['platform.media.identify.musicbrainz_gap_ms' => 0]);
    }

    /** @param  array<string, mixed>  $attributes */
    protected function storedTrack(Station $station, array $attributes = []): Track
    {
        $kind = $attributes['kind'] ?? TrackKind::Song;
        $key = 'music/'.$station->id.'/2026/10/'.Str::uuid().'.mp3';
        Storage::disk((string) config('filesystems.media.public'))->put($key, 'ID3 audio');

        return app(CurrentStation::class)->within($station, fn () => Track::query()->create([
            'kind' => $kind,
            'title' => 'Pedro Navaja',
            'artist' => 'Rubén Blades',
            'file_path' => $key,
            'mime' => 'audio/mpeg',
            'size_bytes' => 9,
            'duration' => 441,
            ...$attributes,
        ]));
    }
}
