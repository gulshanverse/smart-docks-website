export interface CandidateSummary {
  bytes: number;
  quality: number;
  mimeType: string;
}

export function selectCandidate(candidates: readonly CandidateSummary[], targetBytes: number, sourceMime: string): { candidate: CandidateSummary; targetAchieved: boolean } {
  if (candidates.length === 0) throw new Error("At least one compression candidate is required.");
  const accepted = candidates.filter((candidate) => candidate.bytes <= targetBytes);
  const score = (candidate: CandidateSummary) => candidate.quality + (candidate.mimeType === sourceMime ? 0.03 : 0);
  const pool = accepted.length > 0 ? accepted : candidates;
  const candidate = [...pool].sort((a, b) => accepted.length > 0 ? score(b) - score(a) : a.bytes - b.bytes)[0];
  return { candidate, targetAchieved: candidate.bytes <= targetBytes };
}
