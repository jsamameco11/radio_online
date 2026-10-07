<?php

namespace App\Domain\Applications\Support;

use App\Models\Frequency;
use Illuminate\Http\UploadedFile;

/**
 * Everything a "Crear mi radio" form sends, already validated: the station
 * project (kept on the frequency request), the dossier columns and the files.
 */
final readonly class ApplicationSubmission
{
    /**
     * @param  list<int>  $categoryIds
     * @param  array<string, mixed>  $dossier  station_applications columns, without files, hash or consent stamps
     * @param  array{photo: UploadedFile, document_front: UploadedFile, document_back: UploadedFile, resume: UploadedFile, certificates: list<UploadedFile>}  $uploads
     */
    public function __construct(
        public Frequency $frequency,
        public string $stationName,
        public string $purpose,
        public array $categoryIds,
        public array $dossier,
        public array $uploads,
    ) {}
}
