<?php

namespace App\Domain\Applications\Actions;

use App\Domain\Access\Enums\Permission;
use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Enums\UserStatus;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Notifications\StationApplicationSubmitted;
use App\Domain\Applications\Support\ApplicationSubmission;
use App\Domain\Frequencies\Actions\SubmitFrequencyRequest;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Models\FrequencyRequest;
use App\Models\StationApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * "Crear mi radio" with the full dossier: the frequency request (the review
 * workflow) and the applicant's data and documents, all or nothing. Files go
 * to private folders before the transaction and are deleted when it fails.
 * One application under review per account and per identity document.
 */
final class SubmitStationApplication
{
    public function __construct(
        private readonly SubmitFrequencyRequest $submit,
        private readonly MediaStorage $storage,
        private readonly PlatformSettings $settings,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $user, ApplicationSubmission $submission, string $ip, ?string $userAgent = null): FrequencyRequest
    {
        if (! $this->settings->get('frequency_requests_open')) {
            throw ValidationException::withMessages(['frequency_id' => 'Las solicitudes de frecuencia están cerradas por ahora. Vuelve a intentarlo más tarde.']);
        }

        $hash = StationApplication::fingerprint(
            DocumentType::from((string) $submission->dossier['document_type']),
            (string) $submission->dossier['document_number'],
        );
        $this->ensureDocumentIsFree($hash);

        $files = $this->storeUploads($user, $submission->uploads);

        try {
            $request = DB::transaction(function () use ($user, $submission, $hash, $files, $ip, $userAgent) {
                $request = $this->submit->handle($user, $submission->frequency, $submission->stationName, $submission->purpose, $submission->categoryIds);
                $this->ensureDocumentIsFree($hash);

                $now = now();
                $request->application()->create([
                    ...$submission->dossier,
                    ...$files,
                    'document_hash' => $hash,
                    'terms_accepted_at' => $now,
                    'truthfulness_declared_at' => $now,
                    'data_processing_consented_at' => $now,
                    'consent_ip' => $ip,
                    'consent_user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 255),
                ]);

                return $request;
            });
        } catch (Throwable $exception) {
            $this->deleteFiles($files);

            throw $exception;
        }

        Notification::send($this->reviewers(), new StationApplicationSubmitted(
            $request->id,
            $submission->frequency->display(),
            $request->station_name,
            rtrim((string) config('platform.urls.control'), '/')."/admin/solicitudes/{$request->id}/expediente",
        ));

        return $request;
    }

    private function ensureDocumentIsFree(string $hash): void
    {
        $pending = StationApplication::query()
            ->where('document_hash', $hash)
            ->whereHas('frequencyRequest', fn (Builder $query) => $query->where('status', FrequencyRequestStatus::Pending->value))
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages(['document_number' => 'Ya hay una solicitud en revisión con este documento de identidad.']);
        }
    }

    /**
     * @param  array{photo: UploadedFile, document_front: UploadedFile, document_back: UploadedFile, resume: UploadedFile, certificates: list<UploadedFile>}  $uploads
     * @return array{photo_path?: string, document_front_path?: string, document_back_path?: string, resume_path?: string, certificate_paths?: list<string>}
     */
    private function storeUploads(User $user, array $uploads): array
    {
        $files = [];

        try {
            $files['photo_path'] = $this->storage->store($uploads['photo'], MediaFolder::ApplicantPhotos, $user->id);
            $files['document_front_path'] = $this->storage->store($uploads['document_front'], MediaFolder::IdentityDocuments, $user->id);
            $files['document_back_path'] = $this->storage->store($uploads['document_back'], MediaFolder::IdentityDocuments, $user->id);
            $files['resume_path'] = $this->storage->store($uploads['resume'], MediaFolder::Resumes, $user->id);
            $files['certificate_paths'] = [];
            foreach ($uploads['certificates'] as $certificate) {
                $files['certificate_paths'][] = $this->storage->store($certificate, MediaFolder::Certificates, $user->id);
            }
        } catch (Throwable $exception) {
            $this->deleteFiles($files);

            throw $exception;
        }

        return $files;
    }

    /**
     * @param  array<string, string|list<string>>  $files
     */
    private function deleteFiles(array $files): void
    {
        foreach ($files as $keys) {
            foreach ((array) $keys as $key) {
                $this->storage->delete($key);
            }
        }
    }

    /**
     * Active staff who may review requests (super admins pass every permission).
     *
     * @return iterable<User>
     */
    private function reviewers(): iterable
    {
        $permission = Permission::ReviewFrequencyRequests->value;

        return User::query()
            ->where('status', UserStatus::Active->value)
            ->where(fn (Builder $query) => $query
                ->whereHas('permissions', fn (Builder $permissions) => $permissions->where('name', $permission))
                ->orWhereHas('roles', fn (Builder $roles) => $roles
                    ->where('name', PlatformRole::SuperAdmin->value)
                    ->orWhereHas('permissions', fn (Builder $permissions) => $permissions->where('name', $permission))))
            ->get();
    }
}
