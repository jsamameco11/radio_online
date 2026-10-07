<?php

namespace App\Domain\Applications\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Storage\MediaStorage;
use App\Models\StationApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Deletes the photo and documents of applications that will not become a
 * station (data minimization, Ley 29733): at once when the applicant
 * withdraws, RETENTION_DAYS after a rejection. The written dossier stays.
 */
final class PurgeApplicationDocuments
{
    public const RETENTION_DAYS = 30;

    public function __construct(
        private readonly MediaStorage $storage,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(StationApplication $application, ?User $actor = null): void
    {
        if ($application->documents_purged_at !== null) {
            return;
        }

        foreach ($application->documents() as $file) {
            $this->storage->delete($file['key']);
        }

        $application->forceFill([
            'photo_path' => null,
            'document_front_path' => null,
            'document_back_path' => null,
            'resume_path' => null,
            'certificate_paths' => null,
            'documents_purged_at' => now(),
        ])->save();

        $this->audit->record('frequency_request.documents_purged', $application->loadMissing('frequencyRequest')->frequencyRequest, [], $actor);
    }

    /** Rejected or withdrawn applications decided more than RETENTION_DAYS ago. Returns how many were purged. */
    public function expired(): int
    {
        $purged = 0;

        StationApplication::query()
            ->whereNull('documents_purged_at')
            ->whereHas('frequencyRequest', fn (Builder $query) => $query
                ->whereIn('status', [FrequencyRequestStatus::Rejected->value, FrequencyRequestStatus::Cancelled->value])
                ->where('updated_at', '<', now()->subDays(self::RETENTION_DAYS)))
            ->with('frequencyRequest')
            ->chunkById(100, function ($applications) use (&$purged) {
                foreach ($applications as $application) {
                    $this->handle($application);
                    $purged++;
                }
            });

        return $purged;
    }
}
