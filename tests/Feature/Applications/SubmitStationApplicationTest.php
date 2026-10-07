<?php

namespace Tests\Feature\Applications;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Notifications\StationApplicationSubmitted;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Platform\PlatformSettings;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\StationApplication;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SubmitStationApplicationTest extends TestCase
{
    use ApplicationFixtures, RefreshDatabase;

    private User $applicant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        $this->seed(CategorySeeder::class);
        $this->applicant = User::factory()->create();
    }

    #[Test]
    public function an_applicant_sends_the_complete_dossier(): void
    {
        Notification::fake();
        $reviewer = $this->staff(PlatformRole::Admin);
        $moderator = tap(User::factory()->withTwoFactor()->create())->assignRole(PlatformRole::Moderator->value);
        $frequency = Frequency::factory()->create();

        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload($frequency))
            ->assertSessionHasNoErrors()
            ->assertRedirect($this->publicUrl('/obten-tu-frecuencia'))
            ->assertSessionHas('success');

        $request = FrequencyRequest::query()->with('application')->sole();
        $this->assertSame($this->applicant->id, $request->user_id);
        $this->assertSame(FrequencyRequestStatus::Pending, $request->status);
        $this->assertSame('Radio Inti', $request->station_name);
        $this->assertStringStartsWith('Queremos una radio', $request->pitch);
        $this->assertSame(FrequencyStatus::Available, $frequency->fresh()->status);

        $application = $request->application;
        $this->assertSame('45678912', $application->document_number);
        $this->assertSame(StationApplication::fingerprint(DocumentType::Dni, '45678912'), $application->document_hash);
        $this->assertSame('+51987654321', $application->phone);
        $this->assertSame(['mon', 'wed', 'sat'], $application->broadcast_days);
        $this->assertSame(['es', 'qu'], $application->languages);
        $this->assertTrue($application->content_types->contains(ContentType::Cultural));
        $this->assertTrue($application->represents_organization);
        $this->assertSame('20123456789', $application->organization_tax_id);
        $this->assertSame(['facebook' => 'https://facebook.com/radiointi'], $application->social_links);
        $this->assertNotNull($application->terms_accepted_at);
        $this->assertNotNull($application->data_processing_consented_at);
        $this->assertSame('127.0.0.1', $application->consent_ip);

        $raw = DB::table('station_applications')->value('document_number');
        $this->assertStringNotContainsString('45678912', (string) $raw);
        $this->assertSame('45678912', decrypt($raw, false));

        $private = Storage::disk((string) config('filesystems.media.private'));
        $this->assertStringStartsWith('applicant-photos/'.$this->applicant->id.'/', $application->photo_path);
        $this->assertStringStartsWith('identity-documents/', $application->document_front_path);
        $this->assertStringStartsWith('identity-documents/', $application->document_back_path);
        $this->assertStringStartsWith('resumes/', $application->resume_path);
        $this->assertCount(1, $application->certificate_paths);
        $this->assertStringStartsWith('certificates/', $application->certificate_paths[0]);
        foreach ($application->documents() as $file) {
            $private->assertExists($file['key']);
        }
        Storage::disk((string) config('filesystems.media.public'))->assertDirectoryEmpty('/');

        $audit = AuditLog::query()->where('action', 'frequency_request.submitted')->sole();
        $this->assertStringNotContainsString('45678912', (string) json_encode($audit->meta));
        $this->assertStringNotContainsString('Quispe', (string) json_encode($audit->meta));

        Notification::assertSentTo($reviewer, StationApplicationSubmitted::class, fn (StationApplicationSubmitted $notification) => $notification->requestId === $request->id);
        Notification::assertNotSentTo([$moderator, $this->applicant], StationApplicationSubmitted::class);

        $this->actingAs($this->applicant)
            ->get($this->publicUrl('/obten-tu-frecuencia'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/CreateStation')
                ->where('hasPending', true)
                ->has('requests', 1)
                ->missing('requests.0.application')
                ->missing('requests.0.document_number'));
    }

    #[Test]
    public function the_organization_fields_are_dropped_when_applying_as_a_person(): void
    {
        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), [
                'represents_organization' => '0',
                'organization_name' => '',
                'certificates' => [],
            ]))
            ->assertSessionHasNoErrors();

        $application = StationApplication::query()->sole();
        $this->assertFalse($application->represents_organization);
        $this->assertNull($application->organization_name);
        $this->assertNull($application->organization_tax_id);
        $this->assertSame([], $application->certificate_paths);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidDossiers(): array
    {
        return [
            'minor' => [['birth_date' => now()->subYears(17)->toDateString()], 'birth_date'],
            'short DNI' => [['document_number' => '1234567'], 'document_number'],
            'DNI with letters' => [['document_number' => '1234567A'], 'document_number'],
            'passport too short' => [['document_type' => 'passport', 'document_number' => 'AB12'], 'document_number'],
            'phone without country code' => [['phone' => '987654321'], 'phone'],
            'unknown nationality' => [['nationality' => 'ZZ'], 'nationality'],
            'short purpose' => [['purpose' => 'Una radio de música.'], 'purpose'],
            'no content types' => [['content_types' => []], 'content_types'],
            'unknown content type' => [['content_types' => ['gossip']], 'content_types.0'],
            'organization without a name' => [['organization_name' => ''], 'organization_name'],
            'bad social link' => [['social_links' => ['facebook' => 'facebook radio']], 'social_links.facebook'],
            'terms not accepted' => [['accept_terms' => '0'], 'accept_terms'],
            'no data consent' => [['consent_data_processing' => null], 'consent_data_processing'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[Test]
    #[DataProvider('invalidDossiers')]
    public function invalid_dossiers_are_rejected(array $overrides, string $field): void
    {
        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), $overrides))
            ->assertSessionHasErrors($field);

        $this->assertSame(0, FrequencyRequest::query()->count());
        Storage::disk((string) config('filesystems.media.private'))->assertDirectoryEmpty('/');
    }

    /**
     * @return array<string, array{0: string, 1: UploadedFile|list<UploadedFile>, 2: string}>
     */
    public static function invalidFiles(): array
    {
        return [
            'résumé that is not a PDF' => ['resume', UploadedFile::fake()->create('cv.docx', 200, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'resume'],
            'résumé too big' => ['resume', UploadedFile::fake()->create('cv.pdf', 10 * 1024 + 1, 'application/pdf'), 'resume'],
            'photo that is a PDF' => ['photo', UploadedFile::fake()->create('foto.pdf', 200, 'application/pdf'), 'photo'],
            'photo too small' => ['photo', UploadedFile::fake()->image('foto.jpg', 120, 120), 'photo'],
            'photo too big' => ['photo', UploadedFile::fake()->image('foto.jpg', 600, 800)->size(5 * 1024 + 1), 'photo'],
            'document as a text file' => ['document_front', UploadedFile::fake()->create('dni.txt', 10, 'text/plain'), 'document_front'],
            'document too big' => ['document_back', UploadedFile::fake()->create('dni.pdf', 8 * 1024 + 1, 'application/pdf'), 'document_back'],
            'four certificates' => ['certificates', array_map(fn (int $i) => UploadedFile::fake()->create("c{$i}.pdf", 10, 'application/pdf'), range(1, 4)), 'certificates'],
            'certificate as an image' => ['certificates', [UploadedFile::fake()->image('cert.png', 400, 400)], 'certificates.0'],
        ];
    }

    /**
     * @param  UploadedFile|list<UploadedFile>  $file
     */
    #[Test]
    #[DataProvider('invalidFiles')]
    public function invalid_files_are_rejected(string $field, UploadedFile|array $file, string $error): void
    {
        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), [$field => $file]))
            ->assertSessionHasErrors($error);

        $this->assertSame(0, FrequencyRequest::query()->count());
    }

    #[Test]
    public function the_frequency_must_be_free_and_categories_capped(): void
    {
        $max = (int) config('platform.stations.max_categories');

        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->active()->create(), [
                'category_ids' => Category::query()->limit($max + 1)->pluck('id')->all(),
            ]))
            ->assertSessionHasErrors(['frequency_id', 'category_ids']);

        $this->assertSame(0, FrequencyRequest::query()->count());
    }

    #[Test]
    public function only_one_application_per_account_is_under_review(): void
    {
        $this->actingAs($this->applicant)->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()));

        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), ['document_number' => '11112222']))
            ->assertForbidden();

        $this->assertSame(1, FrequencyRequest::query()->count());
    }

    #[Test]
    public function the_platform_decides_how_many_applications_an_account_has_under_review(): void
    {
        app(PlatformSettings::class)->put(['max_pending_requests' => 2]);

        $this->actingAs($this->applicant)->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()));
        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), ['document_number' => '11112222']))
            ->assertSessionHasNoErrors();

        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), ['document_number' => '33334444']))
            ->assertForbidden();

        $this->assertSame(2, FrequencyRequest::query()->count());
    }

    #[Test]
    public function only_one_application_per_document_is_under_review(): void
    {
        $this->actingAs($this->applicant)->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()));

        $this->actingAs(User::factory()->create())
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create(), ['document_number' => '45678912']))
            ->assertSessionHasErrors('document_number');

        $this->assertSame(1, FrequencyRequest::query()->count());
        $this->assertCount(5, Storage::disk((string) config('filesystems.media.private'))->allFiles());

        FrequencyRequest::query()->update(['status' => FrequencyRequestStatus::Rejected->value]);

        $this->actingAs(User::factory()->create())
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()))
            ->assertSessionHasNoErrors();

        $this->assertSame(2, StationApplication::query()->where('document_hash', StationApplication::fingerprint(DocumentType::Dni, '45678912'))->count());
    }

    #[Test]
    public function nothing_is_kept_when_applications_are_closed(): void
    {
        app(PlatformSettings::class)->put(['frequency_requests_open' => false]);

        $this->actingAs($this->applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()))
            ->assertSessionHasErrors('frequency_id');

        $this->assertSame(0, FrequencyRequest::query()->count());
        $this->assertSame([], Storage::disk((string) config('filesystems.media.private'))->allFiles());
    }

    #[Test]
    public function guests_are_sent_to_sign_in(): void
    {
        $this->get($this->publicUrl('/obten-tu-frecuencia'))->assertRedirect($this->publicUrl('/ingresar'));
        $this->post($this->publicUrl('/obten-tu-frecuencia'), [])->assertRedirect($this->publicUrl('/ingresar'));

        $this->assertSame(0, FrequencyRequest::query()->count());
    }

    #[Test]
    public function the_old_address_moves_permanently_and_keeps_the_chosen_frequency(): void
    {
        $this->get($this->publicUrl('/crear-mi-radio?frecuencia=89-30'))
            ->assertStatus(301)
            ->assertRedirect($this->publicUrl('/obten-tu-frecuencia?frecuencia=89-30'));
    }

    #[Test]
    public function applicants_cancel_only_their_own_pending_requests_and_their_documents_are_deleted(): void
    {
        $this->actingAs($this->applicant)->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload(Frequency::factory()->create()));
        $request = FrequencyRequest::query()->with('application')->sole();
        $keys = array_column($request->application->documents(), 'key');
        $url = $this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id);

        $this->actingAs(User::factory()->create())->delete($url)->assertForbidden();
        $this->assertSame(FrequencyRequestStatus::Pending, $request->fresh()->status);

        $this->actingAs($this->applicant)->delete($url)->assertRedirect()->assertSessionHas('success');
        $this->assertSame(FrequencyRequestStatus::Cancelled, $request->fresh()->status);

        $application = $request->application->fresh();
        $this->assertNotNull($application->documents_purged_at);
        $this->assertSame([], $application->documents());
        foreach ($keys as $key) {
            Storage::disk((string) config('filesystems.media.private'))->assertMissing($key);
        }

        $this->actingAs($this->applicant)->delete($url)->assertForbidden();
    }

    #[Test]
    public function the_page_lists_only_the_applicants_own_requests(): void
    {
        StationApplication::factory()->create();

        $this->actingAs($this->applicant)
            ->get($this->publicUrl('/obten-tu-frecuencia'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/CreateStation')
                ->where('hasPending', false)
                ->where('open', true)
                ->has('requests', 0)
                ->has('options.documentTypes', 4)
                ->where('limits.maxCertificates', 3));
    }
}
