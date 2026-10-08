<?php

namespace Tests\Feature\Applications;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Applications\Actions\PurgeApplicationDocuments;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Models\AuditLog;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\StationApplication;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReviewStationApplicationTest extends TestCase
{
    use ApplicationFixtures, RefreshDatabase;

    private StationApplication $application;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        $this->seed(CategorySeeder::class);
        $this->application = StationApplication::factory()
            ->withDocument(DocumentType::Dni, '45678912')
            ->create(['birth_date' => now()->subYears(40)->subDay()->toDateString()]);
        foreach ($this->application->documents() as $file) {
            Storage::disk((string) config('filesystems.media.private'))->put($file['key'], 'documento');
        }
    }

    private function dossierUrl(string $path = '/expediente', ?StationApplication $application = null): string
    {
        return $this->controlUrl('/admin/solicitudes/'.($application ?? $this->application)->frequency_request_id.$path);
    }

    #[Test]
    public function reviewers_read_the_whole_dossier(): void
    {
        $previous = StationApplication::factory()->withDocument(DocumentType::Dni, '4567-8912')->create();
        $previous->frequencyRequest->forceFill(['status' => FrequencyRequestStatus::Rejected])->save();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->dossierUrl())
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Applications/Show')
                ->where('request.id', $this->application->frequency_request_id)
                ->where('request.status', 'pending')
                ->where('application.document.number', '45678912')
                ->where('application.document.type_label', 'DNI')
                ->where('application.age', 40)
                ->where('application.nationality.label', 'Perú')
                ->has('application.files', 4)
                ->where('application.files.0.url', '/admin/solicitudes/'.$this->application->frequency_request_id.'/archivos/foto')
                ->missing('application.photo_path')
                ->missing('application.document_hash')
                ->where('account.id', $this->application->frequencyRequest->user_id)
                ->has('duplicates', 1)
                ->where('duplicates.0.request_id', $previous->frequency_request_id)
                ->where('duplicates.0.status', 'rejected')
                ->where('freeFrequencies', Frequency::freeOptions()));
    }

    #[Test]
    public function documents_open_through_a_short_lived_url_and_every_view_is_audited(): void
    {
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->dossierUrl('/archivos/documento-anverso'))
            ->assertRedirectContains($this->application->document_front_path)
            ->assertRedirectContains('expiration=')
            ->assertHeader('Cache-Control', 'no-store, private');

        $audit = AuditLog::query()->where('action', 'frequency_request.document_viewed')->sole();
        $this->assertSame((string) $this->application->frequency_request_id, $audit->subject_id);
        $this->assertSame(['file' => 'documento-anverso'], $audit->meta);
    }

    #[Test]
    public function missing_or_unknown_files_are_not_found(): void
    {
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)->get($this->dossierUrl('/archivos/certificado-1'))->assertNotFound();
        $this->actingAs($admin)->get($this->dossierUrl('/archivos/contrasena'))->assertNotFound();

        $legacy = FrequencyRequest::query()->create([
            'user_id' => User::factory()->create()->id,
            'frequency_id' => $this->application->frequencyRequest->frequency_id,
            'station_name' => 'Radio Antigua',
            'pitch' => 'Solicitud enviada antes del expediente.',
            'category_ids' => [],
            'status' => FrequencyRequestStatus::Pending,
        ]);
        $this->actingAs($admin)->get($this->controlUrl("/admin/solicitudes/{$legacy->id}/expediente"))->assertNotFound();
    }

    #[Test]
    public function staff_without_the_review_permission_and_listeners_are_kept_out(): void
    {
        $moderator = $this->staff(PlatformRole::Moderator);

        $this->actingAs($moderator)->get($this->dossierUrl())->assertForbidden();
        $this->actingAs($moderator)->get($this->dossierUrl('/archivos/foto'))->assertForbidden();

        $applicant = $this->application->frequencyRequest->user;
        $this->actingAs($applicant)->get($this->dossierUrl())->assertRedirect();
        $this->actingAs($applicant)->get($this->dossierUrl('/archivos/foto'))->assertRedirect();
        $this->actingAs(User::factory()->create())->get($this->dossierUrl('/archivos/documento-anverso'))->assertRedirect();

        $this->assertSame(0, AuditLog::query()->where('action', 'frequency_request.document_viewed')->count());
    }

    #[Test]
    public function reviewers_reject_from_the_dossier(): void
    {
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->from($this->dossierUrl())
            ->post($this->dossierUrl('/rechazar'), ['note' => 'Las fotos del documento no se leen.'])
            ->assertRedirect($this->dossierUrl())
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyRequestStatus::Rejected, $this->application->frequencyRequest->fresh()->status);
    }

    #[Test]
    public function documents_of_old_rejected_applications_are_purged(): void
    {
        $keys = array_column($this->application->documents(), 'key');
        $this->application->frequencyRequest->forceFill(['status' => FrequencyRequestStatus::Rejected])->save();
        $recent = StationApplication::factory()->create();
        $recent->frequencyRequest->forceFill(['status' => FrequencyRequestStatus::Rejected])->save();

        $this->travel(PurgeApplicationDocuments::RETENTION_DAYS + 1)->days();
        $recent->frequencyRequest->touch();

        $this->artisan('applications:purge-documents')->assertSuccessful();

        $this->assertNotNull($this->application->fresh()->documents_purged_at);
        $this->assertNull($this->application->fresh()->photo_path);
        $this->assertNull($recent->fresh()->documents_purged_at);
        foreach ($keys as $key) {
            Storage::disk((string) config('filesystems.media.private'))->assertMissing($key);
        }
    }
}
