<?php

namespace App\Domain\Studio\Recordings\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Models\Recording;
use Illuminate\Validation\ValidationException;

/** Deletes a console recording and its private file; the library audio made from it stays. */
final class DeleteRecording
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly AuditTrail $audit,
        private readonly CurrentStation $current,
    ) {}

    public function handle(Recording $recording): void
    {
        if (in_array($recording->getRawOriginal('status'), [RecordingStatus::Recording->value, RecordingStatus::Saving->value], true)) {
            throw ValidationException::withMessages(['recording' => 'La grabación sigue en curso; termínala en la consola antes de eliminarla.']);
        }
        $this->storage->delete($recording->path);
        $recording->delete();
        $this->audit->record('recording.delete', $this->current->get(), [
            'recording' => $recording->id,
            'started_at' => $recording->started_at?->toIso8601String(),
        ]);
    }
}
