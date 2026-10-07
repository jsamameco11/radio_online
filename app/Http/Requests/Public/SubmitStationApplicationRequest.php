<?php

namespace App\Http\Requests\Public;

use App\Domain\Applications\Enums\ContentType;
use App\Domain\Applications\Enums\DocumentType;
use App\Domain\Applications\Enums\EducationLevel;
use App\Domain\Applications\Enums\Weekday;
use App\Domain\Applications\Support\ApplicationLimits as Limits;
use App\Domain\Applications\Support\ApplicationSubmission;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Support\Locales;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

/** "Obtén tu frecuencia": the full dossier of the person who will run the station, its documents and the project. */
class SubmitStationApplicationRequest extends FormRequest
{
    private const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

    public function authorize(): bool
    {
        return (bool) $this->user()?->can('create', FrequencyRequest::class);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'document_number' => is_string($this->input('document_number')) ? DocumentType::normalize($this->input('document_number')) : $this->input('document_number'),
            'phone' => is_string($this->input('phone')) ? (string) preg_replace('/[\s\-().]+/', '', $this->input('phone')) : $this->input('phone'),
            'organization_tax_id' => is_string($this->input('organization_tax_id')) ? (DocumentType::normalize($this->input('organization_tax_id')) ?: null) : null,
            'represents_organization' => $this->boolean('represents_organization'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maxCategories = (int) config('platform.stations.max_categories');
        $name = ['required', 'string', 'min:2', 'max:80', 'regex:/^[\pL\pM\s\'.\-]+$/u'];
        $text = fn (int $max) => ['required', 'string', "max:{$max}"];
        $optionalUrl = ['nullable', 'url:http,https', 'max:255'];

        return [
            'first_names' => $name,
            'last_names' => $name,
            'document_type' => ['required', Rule::enum(DocumentType::class)],
            'document_number' => ['required', 'string', 'max:20', function (string $attribute, mixed $value, Closure $fail) {
                $type = DocumentType::tryFrom((string) $this->input('document_type'));
                if ($type !== null && preg_match('/'.$type->pattern().'/', (string) $value) !== 1) {
                    $fail("El número de {$type->label()} no es válido: {$type->hint()}");
                }
            }],
            'nationality' => ['required', Rule::in(array_keys(Locales::COUNTRIES))],
            'birth_date' => ['required', 'date_format:Y-m-d', 'after:1900-01-01', 'before_or_equal:'.now()->subYears(Limits::MIN_AGE)->toDateString()],
            'phone' => ['required', 'regex:/^\+[1-9][0-9]{6,14}$/'],
            'country' => ['required', Rule::in(array_keys(Locales::COUNTRIES))],
            'region' => $text(80),
            'city' => $text(80),
            'address' => ['required', 'string', 'min:5', 'max:200'],

            'occupation' => $text(100),
            'education_level' => ['required', Rule::enum(EducationLevel::class)],
            'institution' => ['nullable', 'string', 'max:150'],
            'field_of_study' => ['nullable', 'string', 'max:150'],
            'experience_years' => ['required', 'integer', 'between:0,60'],
            'bio' => ['required', 'string', 'min:'.Limits::BIO_MIN, 'max:'.Limits::BIO_MAX],

            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:'.self::IMAGE_TYPES, 'max:'.Limits::PHOTO_KB, 'dimensions:min_width='.Limits::PHOTO_MIN_PIXELS.',min_height='.Limits::PHOTO_MIN_PIXELS],
            'document_front' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'mimetypes:'.self::IMAGE_TYPES.',application/pdf', 'max:'.Limits::DOCUMENT_KB],
            'document_back' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'mimetypes:'.self::IMAGE_TYPES.',application/pdf', 'max:'.Limits::DOCUMENT_KB],
            'resume' => ['required', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:'.Limits::RESUME_KB],
            'certificates' => ['nullable', 'array', 'max:'.Limits::MAX_CERTIFICATES],
            'certificates.*' => ['file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:'.Limits::CERTIFICATE_KB],

            'station_name' => ['required', 'string', 'min:3', 'max:80'],
            'frequency_id' => ['required', 'integer', Rule::exists('frequencies', 'id')->where('status', FrequencyStatus::Available->value)],
            'category_ids' => ['required', 'array', 'min:1', "max:{$maxCategories}"],
            'category_ids.*' => ['integer', 'distinct', Rule::exists('categories', 'id')->where('active', true)],
            'languages' => ['required', 'array', 'min:1', 'max:'.Limits::MAX_LANGUAGES],
            'languages.*' => ['string', 'distinct', Rule::in(array_keys(Locales::LANGUAGES))],
            'represents_organization' => ['boolean'],
            'organization_name' => ['exclude_unless:represents_organization,true', 'required', 'string', 'min:2', 'max:150'],
            'organization_tax_id' => ['exclude_unless:represents_organization,true', 'nullable', 'regex:/^[A-Z0-9]{6,20}$/'],
            'organization_website' => ['exclude_unless:represents_organization,true', ...$optionalUrl],

            'content_types' => ['required', 'array', 'min:1'],
            'content_types.*' => ['distinct', Rule::enum(ContentType::class)],
            'purpose' => ['required', 'string', 'min:'.Limits::PURPOSE_MIN, 'max:'.Limits::PURPOSE_MAX],
            'target_audience' => ['required', 'string', 'min:'.Limits::AUDIENCE_MIN, 'max:'.Limits::AUDIENCE_MAX],
            'hours_per_week' => ['required', 'integer', 'between:1,168'],
            'broadcast_days' => ['required', 'array', 'min:1', 'max:7'],
            'broadcast_days.*' => ['distinct', Rule::enum(Weekday::class)],
            'schedule_notes' => ['nullable', 'string', 'max:300'],
            'social_links' => ['nullable', 'array:'.implode(',', Limits::SOCIAL_NETWORKS)],
            ...collect(Limits::SOCIAL_NETWORKS)->mapWithKeys(fn (string $network) => ["social_links.{$network}" => $optionalUrl])->all(),
            'demo_url' => $optionalUrl,

            'accept_terms' => ['accepted'],
            'declare_truthful' => ['accepted'],
            'consent_data_processing' => ['accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $maxCategories = (int) config('platform.stations.max_categories');

        return [
            'required' => 'Completa :attribute.',
            'first_names.regex' => 'Escribe los nombres solo con letras.',
            'last_names.regex' => 'Escribe los apellidos solo con letras.',
            'document_type.*' => 'Elige el tipo de documento.',
            'nationality.in' => 'Elige tu nacionalidad de la lista.',
            'country.in' => 'Elige el país de la lista.',
            'birth_date.date_format' => 'Escribe una fecha de nacimiento válida.',
            'birth_date.after' => 'Escribe una fecha de nacimiento válida.',
            'birth_date.before_or_equal' => 'Debes ser mayor de edad ('.Limits::MIN_AGE.' años o más) para administrar una radio.',
            'phone.regex' => 'Escribe el teléfono con el código de país, por ejemplo +51 987 654 321.',
            'education_level.*' => 'Elige tu nivel de estudios.',
            'experience_years.*' => 'Indica tus años de experiencia (entre 0 y 60).',
            'bio.min' => 'Cuéntanos un poco más sobre ti: al menos '.Limits::BIO_MIN.' caracteres.',

            'nationality.required' => 'Elige tu nacionalidad.',
            'country.required' => 'Elige tu país de residencia.',
            'photo.required' => 'Sube una foto tuya en la que se vea tu rostro.',
            'document_front.required' => 'Sube el anverso de tu documento de identidad.',
            'document_back.required' => 'Sube el reverso de tu documento de identidad.',
            'resume.required' => 'Sube tu currículum o constancia de estudios en PDF.',
            'photo.image' => 'La foto debe ser una imagen.',
            'photo.mimes' => 'La foto debe ser JPG, PNG o WebP.',
            'photo.mimetypes' => 'La foto debe ser JPG, PNG o WebP.',
            'photo.max' => 'La foto no puede pesar más de '.(Limits::PHOTO_KB / 1024).' MB.',
            'photo.dimensions' => 'La foto debe medir al menos '.Limits::PHOTO_MIN_PIXELS.' × '.Limits::PHOTO_MIN_PIXELS.' píxeles y mostrar tu rostro con claridad.',
            'document_front.mimes' => 'Sube el anverso como imagen (JPG, PNG, WebP) o PDF.',
            'document_front.mimetypes' => 'Sube el anverso como imagen (JPG, PNG, WebP) o PDF.',
            'document_front.max' => 'El anverso no puede pesar más de '.(Limits::DOCUMENT_KB / 1024).' MB.',
            'document_back.mimes' => 'Sube el reverso como imagen (JPG, PNG, WebP) o PDF.',
            'document_back.mimetypes' => 'Sube el reverso como imagen (JPG, PNG, WebP) o PDF.',
            'document_back.max' => 'El reverso no puede pesar más de '.(Limits::DOCUMENT_KB / 1024).' MB.',
            'resume.mimes' => 'El currículum debe ser un PDF.',
            'resume.mimetypes' => 'El currículum debe ser un PDF.',
            'resume.max' => 'El currículum no puede pesar más de '.(Limits::RESUME_KB / 1024).' MB.',
            'certificates.max' => 'Puedes adjuntar hasta '.Limits::MAX_CERTIFICATES.' certificados.',
            'certificates.*.mimes' => 'Cada certificado debe ser un PDF.',
            'certificates.*.mimetypes' => 'Cada certificado debe ser un PDF.',
            'certificates.*.max' => 'Cada certificado puede pesar hasta '.(Limits::CERTIFICATE_KB / 1024).' MB.',
            'uploaded' => 'No pudimos recibir :attribute. Inténtalo de nuevo.',

            'station_name.min' => 'El nombre de la radio debe tener al menos 3 caracteres.',
            'frequency_id.required' => 'Elige la frecuencia que quieres para tu radio.',
            'frequency_id.exists' => 'Esa frecuencia ya no está disponible. Elige otra.',
            'category_ids.required' => 'Elige al menos una categoría.',
            'category_ids.min' => 'Elige al menos una categoría.',
            'category_ids.max' => "Puedes elegir hasta {$maxCategories} categorías.",
            'category_ids.*.*' => 'Elige categorías activas de la lista, sin repetir.',
            'languages.required' => 'Elige al menos un idioma.',
            'languages.max' => 'Puedes elegir hasta '.Limits::MAX_LANGUAGES.' idiomas.',
            'languages.*.*' => 'Elige idiomas de la lista.',
            'organization_tax_id.regex' => 'Escribe el RUC o identificación tributaria sin espacios (6 a 20 letras o números).',

            'content_types.required' => 'Elige al menos un tipo de contenido.',
            'content_types.*.*' => 'Elige tipos de contenido de la lista.',
            'purpose.min' => 'Cuéntanos con más detalle para qué quieres tu radio: al menos '.Limits::PURPOSE_MIN.' caracteres.',
            'target_audience.min' => 'Describe a tu público con al menos '.Limits::AUDIENCE_MIN.' caracteres.',
            'hours_per_week.*' => 'Indica cuántas horas por semana transmitirás (entre 1 y 168).',
            'broadcast_days.required' => 'Elige al menos un día de transmisión.',
            'broadcast_days.*.*' => 'Elige días de la semana de la lista.',
            'url' => 'Escribe un enlace completo que empiece con https://',

            'accept_terms.accepted' => 'Debes aceptar los términos y condiciones.',
            'declare_truthful.accepted' => 'Debes declarar que la información es verdadera.',
            'consent_data_processing.accepted' => 'Debes autorizar el tratamiento de tus datos personales.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'first_names' => 'tus nombres',
            'last_names' => 'tus apellidos',
            'document_type' => 'el tipo de documento',
            'document_number' => 'el número de documento',
            'nationality' => 'tu nacionalidad',
            'birth_date' => 'tu fecha de nacimiento',
            'phone' => 'tu teléfono',
            'country' => 'tu país de residencia',
            'region' => 'tu región o departamento',
            'city' => 'tu ciudad',
            'address' => 'tu dirección',
            'occupation' => 'tu profesión u ocupación',
            'education_level' => 'tu nivel de estudios',
            'institution' => 'la institución',
            'field_of_study' => 'la carrera o especialidad',
            'experience_years' => 'tus años de experiencia',
            'bio' => 'tu presentación',
            'photo' => 'tu foto',
            'document_front' => 'el anverso del documento',
            'document_back' => 'el reverso del documento',
            'resume' => 'tu currículum',
            'station_name' => 'el nombre de la radio',
            'organization_name' => 'el nombre de la organización',
            'organization_website' => 'la web de la organización',
            'purpose' => 'para qué quieres tu radio',
            'target_audience' => 'tu público objetivo',
            'hours_per_week' => 'las horas por semana',
            'schedule_notes' => 'el horario previsto',
            'demo_url' => 'el enlace de muestra',
        ];
    }

    public function submission(): ApplicationSubmission
    {
        $data = $this->validated();
        $organization = (bool) $data['represents_organization'];
        $optional = fn (string $key) => filled($data[$key] ?? null) ? trim((string) $data[$key]) : null;

        return new ApplicationSubmission(
            frequency: Frequency::query()->findOrFail((int) $data['frequency_id']),
            stationName: trim((string) $data['station_name']),
            purpose: trim((string) $data['purpose']),
            categoryIds: array_values(array_map('intval', (array) $data['category_ids'])),
            dossier: [
                'first_names' => trim((string) $data['first_names']),
                'last_names' => trim((string) $data['last_names']),
                'document_type' => (string) $data['document_type'],
                'document_number' => (string) $data['document_number'],
                'nationality' => (string) $data['nationality'],
                'birth_date' => (string) $data['birth_date'],
                'phone' => (string) $data['phone'],
                'country' => (string) $data['country'],
                'region' => trim((string) $data['region']),
                'city' => trim((string) $data['city']),
                'address' => trim((string) $data['address']),
                'occupation' => trim((string) $data['occupation']),
                'education_level' => (string) $data['education_level'],
                'institution' => $optional('institution'),
                'field_of_study' => $optional('field_of_study'),
                'experience_years' => (int) $data['experience_years'],
                'bio' => trim((string) $data['bio']),
                'content_types' => array_values(array_unique((array) $data['content_types'])),
                'target_audience' => trim((string) $data['target_audience']),
                'hours_per_week' => (int) $data['hours_per_week'],
                'broadcast_days' => array_values(array_filter(
                    array_map(fn (Weekday $day) => $day->value, Weekday::cases()),
                    fn (string $day) => in_array($day, (array) $data['broadcast_days'], true),
                )),
                'schedule_notes' => $optional('schedule_notes'),
                'languages' => array_values(array_unique((array) $data['languages'])),
                'represents_organization' => $organization,
                'organization_name' => $organization ? $optional('organization_name') : null,
                'organization_tax_id' => $organization ? $optional('organization_tax_id') : null,
                'organization_website' => $organization ? $optional('organization_website') : null,
                'social_links' => array_filter(
                    collect(Limits::SOCIAL_NETWORKS)->mapWithKeys(fn (string $network) => [$network => $data['social_links'][$network] ?? null])->all(),
                    fn (mixed $link) => filled($link),
                ),
                'demo_url' => $optional('demo_url'),
            ],
            uploads: [
                'photo' => $this->fileOrFail('photo'),
                'document_front' => $this->fileOrFail('document_front'),
                'document_back' => $this->fileOrFail('document_back'),
                'resume' => $this->fileOrFail('resume'),
                'certificates' => array_values(array_filter((array) $this->file('certificates', []), fn (mixed $file) => $file instanceof UploadedFile)),
            ],
        );
    }

    private function fileOrFail(string $key): UploadedFile
    {
        $file = $this->file($key);
        abort_unless($file instanceof UploadedFile, 422);

        return $file;
    }
}
