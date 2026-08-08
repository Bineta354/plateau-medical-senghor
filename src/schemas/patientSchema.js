import { z } from 'zod';

// Alignés sur les contraintes de la table public.patients (supabase/migrations)
const PHONE_REGEX = /^[0-9\s+\-()]{10,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^[A-Za-z0-9\s\-/]*$/;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const dateNaissanceSchema = z
  .string()
  .min(1, 'La date de naissance est obligatoire')
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Date de naissance invalide')
  .refine(
    (v) => new Date(v) <= startOfToday(),
    "La date de naissance ne peut pas être postérieure à aujourd'hui"
  )
  .refine((v) => {
    const t = startOfToday();
    const oneYearAgo = new Date(t.getFullYear() - 1, t.getMonth(), t.getDate());
    return new Date(v) <= oneYearAgo;
  }, "La date de naissance doit correspondre à un âge d'au moins 1 an")
  .refine((v) => {
    const t = startOfToday();
    const minDate = new Date(t.getFullYear() - 120, t.getMonth(), t.getDate());
    return new Date(v) >= minDate;
  }, 'La date de naissance est invalide (âge supérieur à 120 ans)');

const optionalPhone = (label) =>
  z
    .string()
    .trim()
    .max(30, `${label} ne doit pas dépasser 30 caractères`)
    .refine((v) => v === '' || PHONE_REGEX.test(v.replace(/\s/g, '')), 'Format de téléphone invalide')
    .optional();

const optionalCode = (label, max = 50) =>
  z
    .string()
    .trim()
    .max(max, `${label} ne doit pas dépasser ${max} caractères`)
    .refine((v) => v === '' || CODE_REGEX.test(v), `${label} contient des caractères non autorisés`)
    .optional();

const optionalText = (max, message) => z.string().trim().max(max, message).optional();

export const patientSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire').max(100, 'Le nom ne doit pas dépasser 100 caractères'),
  prenom: z
    .string()
    .trim()
    .min(1, 'Le prénom est obligatoire')
    .max(100, 'Le prénom ne doit pas dépasser 100 caractères'),
  date_naissance: dateNaissanceSchema,
  sexe: z.union([z.literal('M'), z.literal('F'), z.literal('')]).optional(),
  telephone: optionalPhone('Le téléphone'),
  telephone_contact: optionalPhone('Le téléphone de contact'),
  email: z
    .string()
    .trim()
    .max(255, "L'email ne doit pas dépasser 255 caractères")
    .refine((v) => v === '' || EMAIL_REGEX.test(v), "Format d'email invalide")
    .optional(),
  adresse: optionalText(255, "L'adresse ne doit pas dépasser 255 caractères"),
  // numero_secu rendu unique par tenant en base (migration 20260805000000). numero_ipm
  // reste volontairement non-unique : ce numéro d'assurance peut être partagé entre
  // plusieurs membres d'une même famille.
  numero_secu: optionalCode('Le numéro FNR'),
  numero_ipm: optionalCode('Le numéro IPM'),
  lieu_naissance: optionalText(255, 'Le lieu de naissance ne doit pas dépasser 255 caractères'),
  nationalite: optionalText(255, 'La nationalité ne doit pas dépasser 255 caractères'),
  profession: optionalText(255, 'La profession ne doit pas dépasser 255 caractères'),
  situation_familiale: optionalText(100, 'La situation familiale ne doit pas dépasser 100 caractères'),
  personne_contact: optionalText(255, 'La personne de contact ne doit pas dépasser 255 caractères'),
  lien_contact: optionalText(100, 'Le lien de contact ne doit pas dépasser 100 caractères'),
  groupe_sanguin: z
    .union([z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']), z.literal('')])
    .optional(),
  notes: z.string().trim().optional(),
});

export function validatePatientForm(formData) {
  const result = patientSchema.safeParse(formData);
  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field !== undefined && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { isValid: false, errors };
}

export function getDateNaissanceError(value) {
  const result = dateNaissanceSchema.safeParse(value);
  return result.success ? '' : result.error.issues[0].message;
}

// Champs uniques par tenant en base (migration 20260805000000) via un index partiel
// WHERE ... IS NOT NULL : une chaîne vide ('') n'est PAS NULL et entrerait donc en
// collision avec toutes les autres fiches laissées vides. On les normalise en NULL
// avant l'insertion/mise à jour pour que "non renseigné" ne casse jamais l'unicité.
const NULLABLE_UNIQUE_FIELDS = ['numero_secu', 'numero_ipm', 'email'];

export function normalizePatientPayload(data) {
  const normalized = { ...data };
  for (const field of NULLABLE_UNIQUE_FIELDS) {
    if (typeof normalized[field] === 'string') {
      const trimmed = normalized[field].trim();
      normalized[field] = trimmed === '' ? null : trimmed;
    }
  }
  return normalized;
}
