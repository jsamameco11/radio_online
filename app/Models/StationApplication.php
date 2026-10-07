<?php

namespace App\Models;

use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Enums\EducationLevel;
use Database\Factories\StationApplicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\AsEnumCollection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The dossier of a "Obtén tu frecuencia" request: the person who will run the
 * station, their documents and the station project. Personal data; only
 * staff reviewing requests may read it.
 */
#[Fillable([
    'frequency_request_id', 'first_names', 'last_names', 'document_type', 'document_number', 'document_hash',
    'nationality', 'birth_date', 'phone', 'country', 'region', 'city', 'address',
    'occupation', 'education_level', 'institution', 'field_of_study', 'experience_years', 'bio',
    'photo_path', 'document_front_path', 'document_back_path', 'resume_path', 'certificate_paths', 'documents_purged_at',
    'content_types', 'target_audience', 'hours_per_week', 'broadcast_days', 'schedule_notes', 'languages',
    'represents_organization', 'organization_name', 'organization_tax_id', 'organization_website', 'social_links', 'demo_url',
    'terms_accepted_at', 'truthfulness_declared_at', 'data_processing_consented_at', 'consent_ip', 'consent_user_agent',
])]
#[Hidden(['document_number', 'document_hash', 'photo_path', 'document_front_path', 'document_back_path', 'resume_path', 'certificate_paths', 'consent_ip', 'consent_user_agent'])]
class StationApplication extends Model
{
    /** @use HasFactory<StationApplicationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'document_number' => 'encrypted',
            'birth_date' => 'date',
            'education_level' => EducationLevel::class,
            'experience_years' => 'integer',
            'certificate_paths' => 'array',
            'documents_purged_at' => 'datetime',
            'content_types' => AsEnumCollection::of(ContentType::class),
            'hours_per_week' => 'integer',
            'broadcast_days' => 'array',
            'languages' => 'array',
            'represents_organization' => 'boolean',
            'social_links' => 'array',
            'terms_accepted_at' => 'datetime',
            'truthfulness_declared_at' => 'datetime',
            'data_processing_consented_at' => 'datetime',
        ];
    }

    public function frequencyRequest(): BelongsTo
    {
        return $this->belongsTo(FrequencyRequest::class);
    }

    /**
     * Keyed hash of a document, so the same document can be found across
     * applications without storing or comparing the number in clear.
     */
    public static function fingerprint(DocumentType $type, string $number): string
    {
        return hash_hmac('sha256', $type->value.'|'.DocumentType::normalize($number), (string) config('app.key'));
    }

    public function fullName(): string
    {
        return trim($this->first_names.' '.$this->last_names);
    }

    public function age(): int
    {
        return (int) $this->birth_date->age;
    }

    /**
     * Stored files by their address in the review panel ("foto", "cv", "certificado-2"…).
     *
     * @return array<string, array{label: string, key: string}>
     */
    public function documents(): array
    {
        $files = [
            'foto' => ['Foto del responsable', $this->photo_path],
            'documento-anverso' => ['Documento de identidad · anverso', $this->document_front_path],
            'documento-reverso' => ['Documento de identidad · reverso', $this->document_back_path],
            'cv' => ['Currículum y estudios', $this->resume_path],
        ];
        foreach (array_values($this->certificate_paths ?? []) as $index => $key) {
            $files['certificado-'.($index + 1)] = ['Certificado '.($index + 1), $key];
        }

        return collect($files)
            ->filter(fn (array $file) => is_string($file[1]) && $file[1] !== '')
            ->map(fn (array $file) => ['label' => $file[0], 'key' => (string) $file[1]])
            ->all();
    }
}
