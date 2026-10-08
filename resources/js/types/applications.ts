import type { Option } from "@/types/site";

/** App\Http\Controllers\Public\StationApplicationController::create() "options". */
export interface ApplicationOptions {
  documentTypes: (Option & { pattern: string; hint: string })[];
  educationLevels: Option[];
  contentTypes: Option[];
  audienceAges: Option[];
  audienceTags: AudienceTagGroup[];
  weekdays: Option[];
  countries: Option[];
  languages: Option[];
  socialNetworks: string[];
}

/** App\Domain\Applications\Enums\AudienceTag::grouped() */
export interface AudienceTagGroup extends Option {
  options: Option[];
}

/** App\Domain\Applications\Support\ApplicationLimits::forForm() plus the document retention; sizes in kilobytes. */
export interface ApplicationLimits {
  retentionDays: number;
  minAge: number;
  photoKb: number;
  photoMinPixels: number;
  documentKb: number;
  resumeKb: number;
  certificateKb: number;
  maxCertificates: number;
  bioMin: number;
  bioMax: number;
  purposeMin: number;
  purposeMax: number;
  maxAudienceTags: number;
  maxLanguages: number;
}

/** App\Http\Resources\Admin\StationApplicationResource */
export interface ApplicationDossier {
  id: number;
  full_name: string;
  first_names: string;
  last_names: string;
  document: { type: string; type_label: string; number: string };
  nationality: { code: string; label: string };
  birth_date: string;
  age: number;
  phone: string;
  country: { code: string; label: string };
  region: string;
  city: string;
  address: string;
  occupation: string;
  education_level: Option;
  institution: string | null;
  field_of_study: string | null;
  experience_years: number;
  bio: string;
  content_types: Option[];
  audience_ages: Option[];
  audience_tags: Option[];
  hours_per_week: number;
  broadcast_days: Option[];
  schedule: string | null;
  languages: Option[];
  organization: { name: string | null; tax_id: string | null; website: string | null } | null;
  social_links: Record<string, string>;
  demo_url: string | null;
  files: { slug: string; label: string; kind: "image" | "pdf"; url: string }[];
  documents_purged_at: string | null;
  consent: { terms_accepted_at: string; truthfulness_declared_at: string; data_processing_consented_at: string; ip: string };
  submitted_at: string;
}

export interface ApplicantAccount {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  status: string;
  status_label: string;
  created_at: string;
  requests: number;
  stations: number;
}

export interface DuplicateApplication {
  request_id: number;
  station_name: string;
  frequency: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_label: string;
  applicant: string;
  same_account: boolean;
  created_at: string;
}
