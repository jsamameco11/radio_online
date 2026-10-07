<?php

namespace App\Domain\Studio\Library;

use App\Domain\Storage\MediaStorage;
use App\Models\Track;
use Throwable;

/**
 * Checks that the files of the current station's library are still in
 * storage and not empty. Audios with a problem are marked, so the automatic
 * music skips them and the library shows them for review; a file that comes
 * back is cleared.
 */
final class FileHealth
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly PlayoutCaches $caches,
    ) {}

    /** @return array{checked: int, problems: int} */
    public function checkAll(): array
    {
        $checked = 0;
        $problems = 0;
        $changed = false;
        Track::query()->orderBy('id')->chunkById(200, function ($tracks) use (&$checked, &$problems, &$changed) {
            foreach ($tracks as $track) {
                $before = $track->file_problem;
                $problem = $this->problemOf($track);
                $track->forceFill([
                    'file_problem' => $problem?->value,
                    'file_problem_at' => $problem === null ? null : ($before === $problem->value ? $track->file_problem_at : now()),
                    'file_checked_at' => now(),
                ])->saveQuietly();
                $checked++;
                $problems += $problem === null ? 0 : 1;
                $changed = $changed || $before !== $problem?->value;
            }
        });
        if ($changed) {
            $this->caches->flush();
        }

        return ['checked' => $checked, 'problems' => $problems];
    }

    public function problemOf(Track $track): ?FileProblem
    {
        try {
            if (! $this->storage->exists($track->file_path)) {
                return FileProblem::Missing;
            }
            $disk = $this->storage->disk($this->storage->folderOf($track->file_path));

            return $disk->size($track->file_path) > 0 ? null : FileProblem::Empty;
        } catch (Throwable) {
            return FileProblem::Missing;
        }
    }
}
