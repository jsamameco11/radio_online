<?php

namespace App\Http\Resources\Admin;

use App\Domain\Applications\Enums\AudienceAge;
use App\Domain\Applications\Enums\AudienceTag;
use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\Weekday;
use App\Domain\Stations\Support\Locales;
use App\Models\StationApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The applicant's dossier as reviewers see it: personal data in clear and
 * files as links to the review panel (never storage keys). Staff only.
 *
 * @mixin StationApplication
 */
class StationApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $country = fn (string $code) => ['code' => $code, 'label' => Locales::COUNTRIES[$code] ?? $code];

        return [
            'id' => $this->id,
            'full_name' => $this->fullName(),
            'first_names' => $this->first_names,
            'last_names' => $this->last_names,
            'document' => [
                'type' => $this->document_type->value,
                'type_label' => $this->document_type->label(),
                'number' => $this->document_number,
            ],
            'nationality' => $country($this->nationality),
            'birth_date' => $this->birth_date->toDateString(),
            'age' => $this->age(),
            'phone' => $this->phone,
            'country' => $country($this->country),
            'region' => $this->region,
            'city' => $this->city,
            'address' => $this->address,
            'occupation' => $this->occupation,
            'education_level' => ['value' => $this->education_level->value, 'label' => $this->education_level->label()],
            'institution' => $this->institution,
            'field_of_study' => $this->field_of_study,
            'experience_years' => $this->experience_years,
            'bio' => $this->bio,
            'content_types' => $this->content_types->map(fn (ContentType $type) => ['value' => $type->value, 'label' => $type->label()])->values()->all(),
            'audience_ages' => $this->audience_ages->map(fn (AudienceAge $age) => ['value' => $age->value, 'label' => $age->label()])->values()->all(),
            'audience_tags' => $this->audience_tags->map(fn (AudienceTag $tag) => ['value' => $tag->value, 'label' => $tag->label()])->values()->all(),
            'hours_per_week' => $this->hours_per_week,
            'broadcast_days' => array_values(array_map(
                fn (string $day) => ['value' => $day, 'label' => Weekday::tryFrom($day)?->label() ?? $day],
                $this->broadcast_days ?? [],
            )),
            'schedule' => $this->scheduleLabel(),
            'languages' => array_values(array_map(fn (string $code) => ['value' => $code, 'label' => Locales::LANGUAGES[$code] ?? $code], $this->languages ?? [])),
            'organization' => $this->represents_organization ? [
                'name' => $this->organization_name,
                'tax_id' => $this->organization_tax_id,
                'website' => $this->organization_website,
            ] : null,
            'social_links' => (object) ($this->social_links ?? []),
            'demo_url' => $this->demo_url,
            'files' => collect($this->documents())
                ->map(fn (array $file, string $slug) => [
                    'slug' => $slug,
                    'label' => $file['label'],
                    'kind' => str_ends_with(strtolower($file['key']), '.pdf') ? 'pdf' : 'image',
                    'url' => "/admin/solicitudes/{$this->frequency_request_id}/archivos/{$slug}",
                ])
                ->values()
                ->all(),
            'documents_purged_at' => $this->documents_purged_at?->toIso8601String(),
            'consent' => [
                'terms_accepted_at' => $this->terms_accepted_at->toIso8601String(),
                'truthfulness_declared_at' => $this->truthfulness_declared_at->toIso8601String(),
                'data_processing_consented_at' => $this->data_processing_consented_at->toIso8601String(),
                'ip' => $this->consent_ip,
            ],
            'submitted_at' => $this->created_at->toIso8601String(),
        ];
    }
}
