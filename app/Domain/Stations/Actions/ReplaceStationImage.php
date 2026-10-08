<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Models\Station;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use InvalidArgumentException;

/**
 * Uploads (or removes) one of the station images: the logo (the square of
 * its frequency) or the cover photo (the strip on top of its page). The
 * previous file is deleted once the new key is saved.
 */
final class ReplaceStationImage
{
    /** Image slot => [column, folder]. */
    public const SLOTS = [
        'logo' => ['logo_path', MediaFolder::Logos],
        'cover' => ['cover_path', MediaFolder::Covers],
    ];

    public function __construct(
        private readonly MediaStorage $storage,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Station $station, string $slot, ?UploadedFile $file, User $actor): Station
    {
        [$column, $folder] = self::SLOTS[$slot] ?? throw new InvalidArgumentException("Unknown image slot [{$slot}].");

        $previous = $station->getAttribute($column);
        $key = $file === null ? null : $this->storage->store($file, $folder, $station->id);

        $station->forceFill([$column => $key])->save();
        $this->storage->delete($previous);

        $this->audit->record($file === null ? 'station.image_removed' : 'station.image_updated', $station, ['slot' => $slot], $actor);

        return $station;
    }
}
