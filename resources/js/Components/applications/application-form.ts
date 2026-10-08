import type { ApplicationLimits, ApplicationOptions } from "@/types/applications";

/** Fields of App\Http\Requests\Public\SubmitStationApplicationRequest. */
export interface ApplicationForm {
  first_names: string;
  last_names: string;
  document_type: string;
  document_number: string;
  nationality: string;
  birth_date: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  address: string;
  occupation: string;
  education_level: string;
  institution: string;
  field_of_study: string;
  experience_years: string;
  bio: string;
  photo: File | null;
  document_front: File | null;
  document_back: File | null;
  resume: File | null;
  certificates: File[];
  station_name: string;
  frequency_id: number | null;
  category_ids: number[];
  languages: string[];
  represents_organization: boolean;
  organization_name: string;
  organization_tax_id: string;
  organization_website: string;
  content_types: string[];
  purpose: string;
  audience_ages: string[];
  audience_tags: string[];
  hours_per_week: string;
  broadcast_days: string[];
  schedule_start_hour: string;
  schedule_end_hour: string;
  social_links: Record<string, string>;
  demo_url: string;
  accept_terms: boolean;
  declare_truthful: boolean;
  consent_data_processing: boolean;
  accept_broadcast_policy: boolean;
}

export type Errors = Partial<Record<string, string>>;

/** App\Domain\Applications\Enums\AudienceAge::AllAges: it excludes every other range. */
export const ALL_AGES = "all_ages";

/** The new age selection: picking "all ages" clears the ranges, picking a range clears "all ages". */
export function pickAges(previous: string[], next: string[]): string[] {
  if (next.includes(ALL_AGES) && !previous.includes(ALL_AGES)) return [ALL_AGES];
  return next.length > 1 ? next.filter((age) => age !== ALL_AGES) : next;
}

/** "00:00" to "23:00", for the schedule dropdowns. */
export const scheduleHours = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${String(hour).padStart(2, "0")}:00` }));

export interface ValidationContext {
  limits: ApplicationLimits;
  options: ApplicationOptions;
  maxCategories: number;
}

export const steps = [
  { key: "person", title: "Responsable", description: "Quién administrará el canal." },
  { key: "documents", title: "Documentos", description: "Foto, identidad y estudios." },
  { key: "station", title: "Tu canal", description: "Nombre, número y categorías." },
  { key: "content", title: "Contenido y propósito", description: "Qué transmitirás y para quién." },
  { key: "review", title: "Revisión y envío", description: "Confirma y envía tu expediente." },
] as const;

/** Server error keys (and their nested entries) that belong to each step, to jump back to it. */
const stepFields: string[][] = [
  ["first_names", "last_names", "document_type", "document_number", "nationality", "birth_date", "phone", "country", "region", "city", "address", "occupation", "education_level", "institution", "field_of_study", "experience_years", "bio"],
  ["photo", "document_front", "document_back", "resume", "certificates"],
  ["station_name", "frequency_id", "category_ids", "languages", "represents_organization", "organization_name", "organization_tax_id", "organization_website"],
  ["content_types", "purpose", "audience_ages", "audience_tags", "hours_per_week", "broadcast_days", "schedule_start_hour", "schedule_end_hour", "social_links", "demo_url"],
  ["accept_terms", "declare_truthful", "consent_data_processing", "accept_broadcast_policy"],
];

export function stepOf(errorKey: string): number {
  const root = errorKey.split(".")[0];
  const index = stepFields.findIndex((fields) => fields.includes(root));
  return index === -1 ? steps.length - 1 : index;
}

/** Text fields kept in localStorage while the form is filled. Files, the document number and the legal consents are never stored. */
const draftFields = [
  "first_names",
  "last_names",
  "document_type",
  "nationality",
  "birth_date",
  "phone",
  "country",
  "region",
  "city",
  "address",
  "occupation",
  "education_level",
  "institution",
  "field_of_study",
  "experience_years",
  "bio",
  "station_name",
  "frequency_id",
  "category_ids",
  "languages",
  "represents_organization",
  "organization_name",
  "organization_tax_id",
  "organization_website",
  "content_types",
  "purpose",
  "audience_ages",
  "audience_tags",
  "hours_per_week",
  "broadcast_days",
  "schedule_start_hour",
  "schedule_end_hour",
  "social_links",
  "demo_url",
] as const satisfies readonly (keyof ApplicationForm)[];

export function emptyForm(frequencyId: number | null, socialNetworks: string[]): ApplicationForm {
  return {
    first_names: "",
    last_names: "",
    document_type: "dni",
    document_number: "",
    nationality: "PE",
    birth_date: "",
    phone: "+51 ",
    country: "PE",
    region: "",
    city: "",
    address: "",
    occupation: "",
    education_level: "",
    institution: "",
    field_of_study: "",
    experience_years: "",
    bio: "",
    photo: null,
    document_front: null,
    document_back: null,
    resume: null,
    certificates: [],
    station_name: "",
    frequency_id: frequencyId,
    category_ids: [],
    languages: ["es"],
    represents_organization: false,
    organization_name: "",
    organization_tax_id: "",
    organization_website: "",
    content_types: [],
    purpose: "",
    audience_ages: [],
    audience_tags: [],
    hours_per_week: "",
    broadcast_days: [],
    schedule_start_hour: "",
    schedule_end_hour: "",
    social_links: Object.fromEntries(socialNetworks.map((network) => [network, ""])),
    demo_url: "",
    accept_terms: false,
    declare_truthful: false,
    consent_data_processing: false,
    accept_broadcast_policy: false,
  };
}

export function loadDraft(key: string, base: ApplicationForm): ApplicationForm {
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Record<(typeof draftFields)[number], unknown>>;
    const merged: ApplicationForm = { ...base };
    for (const field of draftFields) {
      const value = saved[field];
      const fits = typeof value === typeof base[field] || (field === "frequency_id" && typeof value === "number");
      if (value !== undefined && value !== null && fits) Object.assign(merged, { [field]: value });
    }
    if (base.frequency_id !== null) merged.frequency_id = base.frequency_id;
    return merged;
  } catch {
    return base;
  }
}

export function saveDraft(key: string, data: ApplicationForm): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(draftFields.map((field) => [field, data[field]]))));
  } catch {
    // Private browsing or a full storage: the form keeps working without a draft.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored to remove.
  }
}

export function normalizeDocument(value: string): string {
  return value.replace(/[\s.-]+/g, "").toUpperCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]+/g, "");
}

/** Latest birth date of an adult today, as YYYY-MM-DD. */
export function adultCutoff(minAge: number): string {
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const namePattern = /^[\p{L}\p{M}\s'.-]+$/u;
const megabytes = (kilobytes: number) => `${Math.round(kilobytes / 1024)} MB`;

/** Mirrors the backend rules of one step so the applicant fixes mistakes before moving on. */
export function validateStep(step: number, data: ApplicationForm, { limits, options, maxCategories }: ValidationContext): Errors {
  const errors: Errors = {};
  const required = (field: keyof ApplicationForm, message: string) => {
    const value = data[field];
    if (typeof value === "string" ? value.trim() === "" : value === null) errors[field] = message;
  };

  if (step === 0) {
    for (const [field, label] of [
      ["first_names", "nombres"],
      ["last_names", "apellidos"],
    ] as const) {
      const value = data[field].trim();
      if (value.length < 2) errors[field] = `Escribe tus ${label} completos.`;
      else if (!namePattern.test(value)) errors[field] = `Escribe tus ${label} solo con letras.`;
    }
    const type = options.documentTypes.find((item) => item.value === data.document_type);
    if (!type) errors.document_type = "Elige el tipo de documento.";
    else if (!new RegExp(type.pattern).test(normalizeDocument(data.document_number))) errors.document_number = `El número de ${type.label} no es válido: ${type.hint}`;
    required("nationality", "Elige tu nacionalidad.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) errors.birth_date = "Escribe tu fecha de nacimiento.";
    else if (data.birth_date > adultCutoff(limits.minAge)) errors.birth_date = `Debes ser mayor de edad (${limits.minAge} años o más) para administrar un canal.`;
    if (!/^\+[1-9][0-9]{6,14}$/.test(normalizePhone(data.phone))) errors.phone = "Escribe el teléfono con el código de país, por ejemplo +51 987 654 321.";
    required("country", "Elige tu país de residencia.");
    required("region", "Escribe tu región o departamento.");
    required("city", "Escribe tu ciudad.");
    if (data.address.trim().length < 5) errors.address = "Escribe tu dirección.";
    required("occupation", "Escribe tu profesión u ocupación.");
    required("education_level", "Elige tu nivel de estudios.");
    const years = Number(data.experience_years);
    if (data.experience_years.trim() === "" || !Number.isInteger(years) || years < 0 || years > 60) errors.experience_years = "Indica tus años de experiencia (entre 0 y 60).";
    if (data.bio.trim().length < limits.bioMin) errors.bio = `Cuéntanos un poco más sobre ti: al menos ${limits.bioMin} caracteres.`;
  }

  if (step === 1) {
    if (!data.photo) errors.photo = "Sube una foto tuya en la que se vea tu rostro.";
    else if (data.photo.size > limits.photoKb * 1024) errors.photo = `La foto no puede pesar más de ${megabytes(limits.photoKb)}.`;
    for (const [field, side] of [
      ["document_front", "anverso"],
      ["document_back", "reverso"],
    ] as const) {
      const file = data[field];
      if (!file) errors[field] = `Sube el ${side} de tu documento de identidad.`;
      else if (file.size > limits.documentKb * 1024) errors[field] = `El ${side} no puede pesar más de ${megabytes(limits.documentKb)}.`;
    }
    if (!data.resume) errors.resume = "Sube tu currículum o constancia de estudios en PDF.";
    else if (data.resume.size > limits.resumeKb * 1024) errors.resume = `El currículum no puede pesar más de ${megabytes(limits.resumeKb)}.`;
    if (data.certificates.length > limits.maxCertificates) errors.certificates = `Puedes adjuntar hasta ${limits.maxCertificates} certificados.`;
  }

  if (step === 2) {
    if (data.station_name.trim().length < 3) errors.station_name = "El nombre del canal debe tener al menos 3 caracteres.";
    if (data.frequency_id === null) errors.frequency_id = "Elige el canal que quieres.";
    if (data.category_ids.length === 0) errors.category_ids = "Elige al menos una categoría.";
    else if (data.category_ids.length > maxCategories) errors.category_ids = `Puedes elegir hasta ${maxCategories} categorías.`;
    if (data.languages.length === 0) errors.languages = "Elige al menos un idioma.";
    if (data.represents_organization) {
      if (data.organization_name.trim().length < 2) errors.organization_name = "Escribe el nombre de la organización.";
      if (data.organization_tax_id.trim() !== "" && !/^[A-Z0-9]{6,20}$/.test(normalizeDocument(data.organization_tax_id))) {
        errors.organization_tax_id = "Escribe el RUC o identificación tributaria sin espacios (6 a 20 letras o números).";
      }
      if (data.organization_website.trim() !== "" && !isUrl(data.organization_website.trim())) errors.organization_website = "Escribe un enlace completo que empiece con https://";
    }
  }

  if (step === 3) {
    if (data.content_types.length === 0) errors.content_types = "Elige al menos un tipo de contenido.";
    if (data.purpose.trim().length < limits.purposeMin) errors.purpose = `Cuéntanos con más detalle para qué quieres tu canal: al menos ${limits.purposeMin} caracteres.`;
    if (data.audience_ages.length === 0) errors.audience_ages = "Elige al menos un rango de edad.";
    else if (data.audience_ages.length > 1 && data.audience_ages.includes(ALL_AGES)) errors.audience_ages = "Si eliges «Todas las edades», no marques otros rangos.";
    if (data.audience_tags.length === 0) errors.audience_tags = "Elige al menos un tipo de público.";
    else if (data.audience_tags.length > limits.maxAudienceTags) errors.audience_tags = `Puedes elegir hasta ${limits.maxAudienceTags} tipos de público.`;
    const hours = Number(data.hours_per_week);
    if (data.hours_per_week.trim() === "" || !Number.isInteger(hours) || hours < 1 || hours > 168) errors.hours_per_week = "Indica cuántas horas por semana transmitirás (entre 1 y 168).";
    if (data.broadcast_days.length === 0) errors.broadcast_days = "Elige al menos un día de transmisión.";
    if (data.schedule_start_hour !== "" && data.schedule_end_hour === "") errors.schedule_end_hour = "Elige también la hora de fin.";
    else if (data.schedule_end_hour !== "" && data.schedule_start_hour === "") errors.schedule_start_hour = "Elige también la hora de inicio.";
    else if (data.schedule_start_hour !== "" && data.schedule_start_hour === data.schedule_end_hour) errors.schedule_end_hour = "La hora de fin debe ser distinta de la de inicio.";
    for (const [network, link] of Object.entries(data.social_links)) {
      if (link.trim() !== "" && !isUrl(link.trim())) errors[`social_links.${network}`] = "Escribe un enlace completo que empiece con https://";
    }
    if (data.demo_url.trim() !== "" && !isUrl(data.demo_url.trim())) errors.demo_url = "Escribe un enlace completo que empiece con https://";
  }

  if (step === 4) {
    if (!data.accept_terms) errors.accept_terms = "Debes aceptar los términos y condiciones.";
    if (!data.declare_truthful) errors.declare_truthful = "Debes declarar que la información es verdadera.";
    if (!data.consent_data_processing) errors.consent_data_processing = "Debes autorizar el tratamiento de tus datos personales.";
    if (!data.accept_broadcast_policy) errors.accept_broadcast_policy = "Debes aceptar las políticas de trabajo, privacidad y derechos de autor.";
  }

  return errors;
}
