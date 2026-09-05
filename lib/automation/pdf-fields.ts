import { canonicalizeUrl, cleanText } from "./normalizer";
import { sanitizeSourceTextField } from "./field-sanitizer";

const DATE_PATTERN =
  "(?:\\d{1,2}(?:st|nd|rd|th)?[\\/.\\-]\\d{1,2}[\\/.\\-]20\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+20\\d{2})";

export function sanitizePdfField(value: string | undefined | null, maxLength: number) {
  return sanitizeSourceTextField(value, maxLength);
}

function segment(text: string, labels: string, stops: string, maxLength: number) {
  const match = text.match(
    new RegExp(
      `(?:${labels})\\s*[:\\-]?\\s*(.{1,4000}?)(?=\\s+(?:${stops})\\b|$)`,
      "i"
    )
  );
  return sanitizePdfField(match?.[1], maxLength);
}

function dateAfter(text: string, labels: string) {
  const match = text.match(
    new RegExp(`(?:${labels})[^\\n]{0,160}?(${DATE_PATTERN})`, "i")
  );
  return cleanText(match?.[1]).replace(/(\d)(?:st|nd|rd|th)\b/i, "$1") || null;
}

function vacancyCount(text: string) {
  const patterns = [
    /\btotal\s+(?:(?:number|no\.?)\s+of\s+)?(?:vacanc(?:y|ies)|posts?|fellowships?)\s*[:\-]?\s*(\d{1,5})\b/i,
    /\b(?:number|no\.?)\s+of\s+(?:vacanc(?:y|ies)|posts?|fellowships?)\s*[:\-]\s*(\d{1,5})\b/i,
    /\b(?:number|no\.?)\s+of\s+(?:vacanc(?:y|ies)|posts?|fellowships?)\s+(\d{2,5})\b/i,
    /\b(?:vacanc(?:y|ies)|posts?|fellowship\s*s?)\s*[:\-]\s*(\d{1,5})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1];
    if (!value || match?.index === undefined) continue;
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 4);
    // A single digit followed by a full stop is normally a table/serial-number
    // fragment ("No. of Vacancies 1.") rather than a supported total.
    if (value.length === 1 && /^\s*\./.test(after)) continue;
    return value;
  }
  return null;
}

function organizationName(text: string) {
  const heading = text.slice(0, 2_000).match(
    /\b([A-Z][A-Z0-9 &(),.'\/-]{5,}?(?:LABORATORY|ORGANISATION|ORGANIZATION|COMMISSION|BANK OF INDIA))\b/
  )?.[1];
  return sanitizePdfField(heading, 180);
}

function supportedField(value: string | null, field: "qualification" | "salary" | "age" | "location" | "fee" | "selection" | "howToApply") {
  if (!value) return null;
  const opening = value.slice(0, field === "qualification" ? 180 : 240);
  if (field === "qualification") {
    return /\b(?:10th|12th|iti|graduate|post[ -]?graduate|degree|diploma|b\.?e\.?|b\.?tech|m\.?e\.?|m\.?tech|ph\.?d|master|bachelor|net|gate|education|qualification)\b/i.test(opening) ? value : null;
  }
  if (field === "salary") {
    return /(?:₹|\brs\.?\b|rupees?|pay\s*(?:level|scale|matrix)|salary|stipend|remuneration|emoluments?|per month|monthly)/i.test(opening) ? value : null;
  }
  if (field === "age") {
    return /\b(?:\d{1,3}\s*(?:years?|yrs?)|(?:age\s*(?:limit|as on)|not exceeding|between|min(?:imum)?\.? age|max(?:imum)?\.? age)\D{0,35}\d{1,3}|\d{1,3}\s*(?:-|to)\s*\d{1,3}\s*(?:years?|yrs?)?)\b/i.test(opening) ? value : null;
  }
  if (field === "location") {
    return /\b(?:delhi|mumbai|kolkata|hyderabad|bengaluru|bangalore|chennai|kochi|mysuru|kanpur|ahilyanagar|india|state|city|posting|laboratory|lab|office)\b/i.test(opening) ? value : null;
  }
  if (field === "fee") {
    return /(?:₹|\brs\.?\b|rupees?|\bfee\b|no fee|nil|exempt)/i.test(opening) ? value : null;
  }
  if (field === "selection") {
    return /\b(?:interview|examination|exam|test|merit|shortlist|screening|document verification)\b/i.test(opening) ? value : null;
  }
  return /\b(?:apply|application|submit|send|email|online|offline|prescribed form)\b/i.test(opening) ? value : null;
}

export function findSupportedApplyUrl(text: string) {
  const urlPattern = /https?:\/\/[^\s)\]>]+/gi;
  for (const match of text.matchAll(urlPattern)) {
    const raw = match[0].replace(/[.,;]+$/, "");
    const before = text.slice(Math.max(0, (match.index || 0) - 140), match.index);
    if (
      /\b(?:apply online|online application|submit applications?|candidate portal)\b/i.test(before) ||
      /\b(?:apply|application|recruitment|candidate[-_/]?portal|ibps)\b/i.test(raw)
    ) {
      const url = canonicalizeUrl(raw);
      if (url) return url;
    }
  }
  return null;
}

export function extractRecruitmentPdfFields(textValue: string) {
  const text = cleanText(textValue).replace(/\\([.@/])/g, "$1");
  const commonStops =
    "general (?:conditions|instructions)|(?:upper )?age limit|how to apply|selection (?:process|procedure)|application fee|closing date|last date|important dates|tenure|note|place of posting";

  const qualification = supportedField(segment(
    text,
    "essential qualifications?|minimum (?:educational )?qualifications?|educational qualifications?|eligibility criteria",
    commonStops,
    420
  ), "qualification");
  const salary = supportedField(segment(
    text,
    "salary|pay scale|scale of pay|remuneration|emoluments?|stipend",
    "(?:upper )?age limit|qualification|eligibility|how to apply|selection (?:process|procedure)|application fee|closing date|last date|tenure|note|general (?:conditions|instructions)",
    240
  ), "salary");
  const ageLimit = supportedField(segment(
    text,
    "age limit|upper age limit|maximum age|minimum age",
    "how to apply|selection (?:process|procedure)|application fee|closing date|last date|tenure|note|general (?:conditions|instructions)",
    260
  ), "age");
  const location = supportedField(segment(
    text,
    "place of posting|job location|location|posting at",
    commonStops,
    180
  ), "location");
  const applicationFee = supportedField(segment(
    text,
    "application fee|examination fee|fee payable",
    "how to apply|selection (?:process|procedure)|closing date|last date|important dates|note|general (?:conditions|instructions)",
    220
  ), "fee");
  const selectionProcess = supportedField(segment(
    text,
    "selection process|selection procedure|mode of selection",
    "how to apply|application fee|closing date|last date|important dates|general (?:conditions|instructions)|note",
    420
  ), "selection");
  const howToApply = supportedField(segment(
    text,
    "how to apply|application procedure|procedure to apply",
    "selection (?:process|procedure)|application fee|closing date|last date|important dates|general (?:conditions|instructions)|note",
    600
  ), "howToApply");

  return {
    department: organizationName(text),
    qualification,
    vacancy: vacancyCount(text),
    salary,
    ageLimit,
    location,
    applicationFee,
    selectionProcess,
    howToApply,
    applicationStartDate: dateAfter(
      text,
      "opening date|application start date|start date|online application begins"
    ),
    lastDate: dateAfter(
      text,
      "last date|closing date|application deadline|apply before|closing date of receipt of applications(?: is)?"
    ),
    applyLink: findSupportedApplyUrl(text),
  };
}
