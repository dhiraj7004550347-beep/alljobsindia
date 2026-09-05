import { cleanText } from "./normalizer";
import type { CollectedJob } from "./types";

const RESIDUAL_MOJIBAKE = /(?:\uFFFD|\u00e0[\u00a4\u00a5]|\u00ef\u00bf\u00bd|\u00e2[\u0080-\u00bf]|\u00c2)/;

function repairCommonMojibake(value: string) {
  return value
    .replace(/\u00e2\u0082\u00b9/g, "₹")
    .replace(/\u00e2\u0080\u00a2/g, " ")
    .replace(/\u00e2\u0080[\u0093\u0094]/g, "-")
    .replace(/\u00e2\u0080[\u0098\u0099]/g, "'")
    .replace(/\u00e2\u0080[\u009c\u009d]/g, '"')
    .replace(/\u00e2\u0080\u00a6/g, "...")
    .replace(/\S*(?:\uFFFD|\u00e0[\u00a4\u00a5]|\u00ef\u00bf\u00bd)\S*/g, " ")
    .replace(/\u00c2/g, " ")
    .replace(/\\([.@/])/g, "$1");
}

function bounded(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const prefix = value.slice(0, maxLength);
  const sentence = Math.max(
    prefix.lastIndexOf(". "),
    prefix.lastIndexOf("; "),
    prefix.lastIndexOf(" • ")
  );
  const word = prefix.lastIndexOf(" ");
  const cut = sentence >= Math.floor(maxLength * 0.55) ? sentence + 1 : word;
  return prefix.slice(0, cut > 0 ? cut : maxLength).trim();
}

export function sanitizeSourceTextField(
  value: string | undefined | null,
  maxLength: number
) {
  const cleaned = cleanText(repairCommonMojibake(cleanText(value)))
    .replace(/^(?:is|are)\s+/i, "")
    .replace(/^(?:\(?\d{1,2}[.)]\s*)+/, "")
    .replace(/^[\s:;,./-]+/, "")
    .trim();
  if (!cleaned || RESIDUAL_MOJIBAKE.test(cleaned)) return null;
  return bounded(cleaned, maxLength) || null;
}

function cutAt(value: string, patterns: RegExp[], minimumIndex = 20) {
  let cut = value.length;
  for (const pattern of patterns) {
    const index = value.search(pattern);
    if (index >= minimumIndex && index < cut) cut = index;
  }
  return value.slice(0, cut).trim();
}

function qualification(value: string | null | undefined) {
  let cleaned = sanitizeSourceTextField(value, 1_200);
  if (!cleaned) return null;
  const education = cleaned.search(
    /\b(?:10th|12th|matric|iti|ncvt|scvt|graduate|post[ -]?graduate|b\.?e\.?|b\.?tech|m\.?e\.?|m\.?tech|ph\.?d|degree|diploma|master|bachelor|net|gate)\b/i
  );
  if (
    education > 0 &&
    /(?:date|time|walk[- ]?in|anticipated|name of the post|vacanc|discipline|\bjrf\b)/i.test(
      cleaned.slice(0, education)
    )
  ) {
    cleaned = cleaned.slice(education);
  }
  cleaned = cutAt(cleaned, [
    /\s+(?:date\s*&\s*time|date and time) of walk[- ]?in/i,
    /\s+(?:selection (?:process|procedure)|general (?:conditions|instructions)|how to apply|application procedure|age limit|upper age limit|salary|stipend)\b/i,
    /\s+\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/,
    /\s+\d{1,2}\s*\.\s+(?=[A-Z])/,
  ]);
  if (!/\b(?:10th|12th|matric|iti|ncvt|scvt|graduate|post[ -]?graduate|b\.?e\.?|b\.?tech|m\.?e\.?|m\.?tech|ph\.?d|degree|diploma|master|bachelor|net|gate)\b/i.test(cleaned.slice(0, 200))) {
    return null;
  }
  return sanitizeSourceTextField(cleaned, 420);
}

function vacancy(value: string | null | undefined, rawText: string) {
  const cleaned = sanitizeSourceTextField(value, 20);
  if (!cleaned || !/^(?:\d{1,6}|various|multiple)$/i.test(cleaned)) return null;
  if (/^0*1$/.test(cleaned)) {
    const supportedSingle = /\b(?:total(?: number)? of vacanc(?:y|ies)|total vacanc(?:y|ies)|number of vacanc(?:y|ies)|no\.? of vacanc(?:y|ies))\s*(?::|-|is)\s*0*1\b/i.test(rawText);
    if (!supportedSingle) return null;
  }
  return cleaned;
}

function salary(value: string | null | undefined) {
  let cleaned = sanitizeSourceTextField(value, 800);
  if (!cleaned) return null;
  cleaned = cleaned.replace(/^of\s+/i, "");
  // Recruitment tables often put a generic "(Rs.)" column beside vacancy
  // rows. That is not a single supported pay scale for the opening.
  if (/\btotal vacanc(?:y|ies)\b/i.test(cleaned) || /^\(?rs\.?\)?\s*\d+\s*[.)]/i.test(cleaned)) {
    return null;
  }
  cleaned = cutAt(cleaned, [
    /\s+(?:any additional information|education(?:al)? qualification|upper age limit|age limit|contingency grant|general (?:conditions|instructions))\b/i,
    /\s+\([ivx]+\)\s+(?:education|age|nationality)\b/i,
  ]);
  if (!/(?:₹|\brs\.?\b|rupees?|pay\s*(?:level|scale|matrix)|salary|stipend|remuneration|emoluments?|per month|monthly)/i.test(cleaned)) {
    return null;
  }
  return sanitizeSourceTextField(cleaned, 220);
}

function ageLimit(value: string | null | undefined) {
  let cleaned = sanitizeSourceTextField(value, 800);
  if (!cleaned) return null;
  cleaned = cutAt(cleaned, [
    /\s+(?:nationality|selection (?:process|procedure)|how to apply|application procedure|general (?:conditions|instructions)|candidates who are not|no ta\/da)\b/i,
    /\s+\([ivx]+\)\s+(?:nationality|selection|application)\b/i,
  ]);
  if (!/\b(?:\d{1,3}\s*(?:years?|yrs?)|(?:age\s*(?:limit|as on)|not exceeding|between|min(?:imum)?\.? age|max(?:imum)?\.? age)\D{0,35}\d{1,3}|\d{1,3}\s*(?:-|to)\s*\d{1,3}\s*(?:years?|yrs?)?)\b/i.test(cleaned.slice(0, 260))) {
    return null;
  }
  return sanitizeSourceTextField(cleaned, 240);
}

function applicationFee(value: string | null | undefined) {
  const cleaned = sanitizeSourceTextField(value, 200);
  if (!cleaned || !/(?:₹|\brs\.?\b|rupees?|\bfee\b|no fee|nil|exempt)/i.test(cleaned)) return null;
  return cleaned;
}

function department(value: string | null | undefined) {
  const cleaned = sanitizeSourceTextField(value, 180);
  if (!cleaned) return null;
  if (
    /\b(?:search here|home organisation|about drdo|our team|technology clusters|corporate clusters|offerings|schemes and services|industry support)\b/i.test(cleaned) &&
    /\b(?:search here|about drdo|our team|technology clusters|corporate clusters|schemes and services|industry support)\b/i.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

function selectionProcess(value: string | null | undefined) {
  let cleaned = sanitizeSourceTextField(value, 900);
  if (!cleaned) return null;
  const selection = cleaned.search(/\bselection\s*(?:process|procedure|method)?\s*[:\-]?/i);
  const application = cleaned.search(/\b(?:application procedure|how to apply)\b/i);
  if (application >= 0 && (selection < 0 || application < selection)) return null;
  if (selection > 0) {
    cleaned = cleaned.slice(selection).replace(/^selection\s*(?:process|procedure|method)?\s*[:\-]?\s*/i, "");
  }
  cleaned = cutAt(cleaned, [
    /\s+(?:application procedure|how to apply|general (?:conditions|instructions)|appendix|no ta\/da)\b/i,
    /\s+\d{1,2}\s*\.\s+(?=[A-Z])/,
  ]);
  if (!/\b(?:interview|examination|exam|test|merit|shortlist|screening|document verification)\b/i.test(cleaned.slice(0, 260))) {
    return null;
  }
  return sanitizeSourceTextField(cleaned, 360);
}

export function sanitizeCollectedJobFields(job: CollectedJob): CollectedJob {
  return {
    ...job,
    title: sanitizeSourceTextField(job.title, 240) || job.title.slice(0, 240),
    department: department(job.department),
    qualification: qualification(job.qualification),
    vacancy: vacancy(job.vacancy, job.rawText),
    salary: salary(job.salary),
    ageLimit: ageLimit(job.ageLimit),
    location: sanitizeSourceTextField(job.location, 180),
    applicationFee: applicationFee(job.applicationFee),
    selectionProcess: selectionProcess(job.selectionProcess),
    description: sanitizeSourceTextField(job.description, 2_000),
    howToApply: sanitizeSourceTextField(job.howToApply, 800),
  };
}
