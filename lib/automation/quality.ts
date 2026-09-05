import { canonicalizeUrl, parseSupportedDate } from "./normalizer";
import type { CollectedJob, PreviewJob } from "./types";

export type CandidateQuality = {
  action: PreviewJob["action"];
  reason: string;
};

export function classifyCandidateQuality(
  candidate: CollectedJob,
  confidence: number,
  minimumDraftConfidence: number,
  now = new Date()
): CandidateQuality {
  const title = candidate.title.trim();
  const recognizableTitle = /\b(?:recruit(?:ment|ing)?|engagement|appointment|vacanc(?:y|ies)|applications?|apprentices?|fellowships?|junior research fellow|\bjrf\b|research associate|officers?|managers?|engineers?|scientists?|consultants?|assistants?|associates?|clerks?|trainees?|posts?|walk[- ]?in interview for)\b/i.test(title);
  if (!recognizableTitle || /^(?:walk[- ]?in interview|recruitment|vacanc(?:y|ies)|advertisement|notification)$/i.test(title)) {
    return { action: "LOW_CONFIDENCE", reason: "The notice does not yet have a recognizable recruitment title." };
  }
  const previewFields = [
    candidate.title,
    candidate.department,
    candidate.qualification,
    candidate.vacancy,
    candidate.salary,
    candidate.ageLimit,
    candidate.location,
    candidate.applicationFee,
    candidate.selectionProcess,
  ].filter((value): value is string => Boolean(value));
  if (previewFields.some((value) => /(?:\uFFFD|à[¤¥]|ï¿½|â|class\s*=|views-field|next page|last page)/i.test(value))) {
    return { action: "LOW_CONFIDENCE", reason: "One or more extracted fields contain unreadable or page-layout text." };
  }
  const deadline = parseSupportedDate(candidate.lastDate);
  if (deadline && deadline < now) {
    return { action: "EXPIRED", reason: "The official application deadline has passed." };
  }
  if (/\b(?:result|call letter|admit card|answer key|marks secured|qualified for interview|selected candidates?|provisionally selected|wait ?list|no candidate)\b/i.test(candidate.title)) {
    return { action: "REJECTED", reason: "Result, admit-card, call-letter, or other non-recruitment item." };
  }
  if (!candidate.sourceJobId && !canonicalizeUrl(candidate.notificationLink) && !canonicalizeUrl(candidate.applyLink)) {
    return { action: "LOW_CONFIDENCE", reason: "No stable official notice or apply URL was found." };
  }
  if (candidate.rawText.length < 40) {
    return { action: "LOW_CONFIDENCE", reason: "Not enough official recruitment text was found; manual review required." };
  }
  if (confidence < minimumDraftConfidence) {
    return {
      action: "LOW_CONFIDENCE",
      reason: `Confidence ${Math.round(confidence * 100)}% is below the ${Math.round(minimumDraftConfidence * 100)}% draft threshold.`,
    };
  }
  return { action: "WOULD_ADD", reason: "Official recruitment notice passed the draft quality gate; it remains unverified." };
}
