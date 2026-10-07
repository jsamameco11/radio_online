<?php

namespace Tests\Feature\Applications;

use App\Models\Category;
use App\Models\Frequency;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/** Media disks faked and a complete, valid "Crear mi radio" form. */
trait ApplicationFixtures
{
    protected function fakeMedia(): void
    {
        $this->withoutVite();
        Storage::fake((string) config('filesystems.media.public'));
        Storage::fake((string) config('filesystems.media.private'));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function applicationPayload(Frequency $frequency, array $overrides = []): array
    {
        return [
            'first_names' => 'María José',
            'last_names' => 'Quispe Huamán',
            'document_type' => 'dni',
            'document_number' => '4567 8912',
            'nationality' => 'PE',
            'birth_date' => now()->subYears(32)->toDateString(),
            'phone' => '+51 987 654 321',
            'country' => 'PE',
            'region' => 'Cusco',
            'city' => 'Cusco',
            'address' => 'Calle Plateros 345, Cusco',
            'occupation' => 'Periodista',
            'education_level' => 'university',
            'institution' => 'Universidad Nacional San Antonio Abad',
            'field_of_study' => 'Ciencias de la Comunicación',
            'experience_years' => 8,
            'bio' => 'Periodista con ocho años en radios comunitarias del sur andino, conduciendo noticieros y programas culturales.',
            'photo' => UploadedFile::fake()->image('rostro.jpg', 600, 800),
            'document_front' => UploadedFile::fake()->image('dni-anverso.jpg', 1200, 800),
            'document_back' => UploadedFile::fake()->create('dni-reverso.pdf', 300, 'application/pdf'),
            'resume' => UploadedFile::fake()->create('cv.pdf', 500, 'application/pdf'),
            'certificates' => [UploadedFile::fake()->create('locucion.pdf', 200, 'application/pdf')],
            'station_name' => 'Radio Inti',
            'frequency_id' => $frequency->id,
            'category_ids' => [Category::query()->value('id')],
            'languages' => ['es', 'qu'],
            'represents_organization' => '1',
            'organization_name' => 'Asociación Cultural Inti',
            'organization_tax_id' => '20123456789',
            'organization_website' => 'https://inti.example.org',
            'content_types' => ['music', 'news', 'cultural'],
            'purpose' => str_repeat('Queremos una radio que difunda la música andina, noticias locales y la cultura quechua para nuestra comunidad. ', 2),
            'target_audience' => 'Familias quechuahablantes del Cusco y migrantes en Lima.',
            'hours_per_week' => 30,
            'broadcast_days' => ['sat', 'mon', 'wed'],
            'schedule_notes' => 'Mañanas de 6 a 10.',
            'social_links' => ['facebook' => 'https://facebook.com/radiointi', 'instagram' => ''],
            'demo_url' => 'https://soundcloud.com/radiointi/demo',
            'accept_terms' => '1',
            'declare_truthful' => '1',
            'consent_data_processing' => '1',
            ...$overrides,
        ];
    }
}
