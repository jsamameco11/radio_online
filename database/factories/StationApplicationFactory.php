<?php

namespace Database\Factories;

use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Enums\EducationLevel;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\StationApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * A complete dossier on a pending "Crear mi radio" request of a new user.
 *
 * @extends Factory<StationApplication>
 */
class StationApplicationFactory extends Factory
{
    public function definition(): array
    {
        $number = (string) fake()->unique()->numerify('########');

        return [
            'frequency_request_id' => fn () => FrequencyRequest::query()->create([
                'user_id' => User::factory()->create()->id,
                'frequency_id' => Frequency::factory()->create()->id,
                'station_name' => 'Radio '.fake()->firstName(),
                'pitch' => fake()->paragraph(8),
                'category_ids' => Category::query()->limit(1)->pluck('id')->all(),
                'status' => FrequencyRequestStatus::Pending,
            ])->id,
            'first_names' => fake()->firstName(),
            'last_names' => fake()->lastName().' '.fake()->lastName(),
            'document_type' => DocumentType::Dni,
            'document_number' => $number,
            'document_hash' => StationApplication::fingerprint(DocumentType::Dni, $number),
            'nationality' => 'PE',
            'birth_date' => now()->subYears(30)->toDateString(),
            'phone' => '+51987654321',
            'country' => 'PE',
            'region' => 'Lima',
            'city' => 'Miraflores',
            'address' => 'Av. Larco 123',
            'occupation' => 'Comunicador social',
            'education_level' => EducationLevel::University,
            'institution' => 'Universidad de Lima',
            'field_of_study' => 'Ciencias de la Comunicación',
            'experience_years' => 5,
            'bio' => fake()->paragraph(4),
            'photo_path' => 'applicant-photos/platform/'.now()->format('Y/m').'/'.Str::uuid().'.jpg',
            'document_front_path' => 'identity-documents/platform/'.now()->format('Y/m').'/'.Str::uuid().'.jpg',
            'document_back_path' => 'identity-documents/platform/'.now()->format('Y/m').'/'.Str::uuid().'.pdf',
            'resume_path' => 'resumes/platform/'.now()->format('Y/m').'/'.Str::uuid().'.pdf',
            'certificate_paths' => [],
            'content_types' => [ContentType::Music, ContentType::Interviews],
            'target_audience' => 'Jóvenes y adultos de Lima que disfrutan la salsa clásica.',
            'hours_per_week' => 20,
            'broadcast_days' => ['mon', 'wed', 'fri'],
            'schedule_notes' => 'De 6 a 10 de la mañana.',
            'languages' => ['es'],
            'represents_organization' => false,
            'social_links' => [],
            'terms_accepted_at' => now(),
            'truthfulness_declared_at' => now(),
            'data_processing_consented_at' => now(),
            'consent_ip' => '127.0.0.1',
        ];
    }

    public function forRequest(FrequencyRequest $request): static
    {
        return $this->state(fn () => ['frequency_request_id' => $request->id]);
    }

    public function withDocument(DocumentType $type, string $number): static
    {
        return $this->state(fn () => [
            'document_type' => $type,
            'document_number' => DocumentType::normalize($number),
            'document_hash' => StationApplication::fingerprint($type, $number),
        ]);
    }
}
