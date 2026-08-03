import type { RoutingCandidate, RoutingDecision, RoutingRequest } from './types.js';

const HOUR_MS = 60 * 60 * 1000;

function normalizeSkills(skills: string[]): Set<string> {
  return new Set(skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));
}

function eligible(candidate: RoutingCandidate, requiredSkills: Set<string>): boolean {
  if (candidate.presence !== 'AVAILABLE') return false;
  if (candidate.activeCallCount >= candidate.maxConcurrentCalls) return false;

  const candidateSkills = normalizeSkills(candidate.skills);
  return [...requiredSkills].every((skill) => candidateSkills.has(skill));
}

export function routeCall(
  request: RoutingRequest,
  candidates: RoutingCandidate[],
  now = new Date(),
): RoutingDecision | null {
  const requiredSkills = normalizeSkills(request.requiredSkills);
  const preferredSkills = normalizeSkills(request.preferredSkills ?? []);

  const scored = candidates
    .filter((candidate) => eligible(candidate, requiredSkills))
    .map((candidate) => {
      const candidateSkills = normalizeSkills(candidate.skills);
      const preferredMatches = [...preferredSkills].filter((skill) =>
        candidateSkills.has(skill),
      ).length;
      const idleHours = candidate.lastAssignedAt
        ? Math.min((now.getTime() - candidate.lastAssignedAt.getTime()) / HOUR_MS, 24)
        : 24;
      const capacity = candidate.maxConcurrentCalls - candidate.activeCallCount;
      const score = preferredMatches * 100 + idleHours * 2 + capacity * 10;

      return {
        agentId: candidate.id,
        score: Number(score.toFixed(2)),
        reason: `${requiredSkills.size} required skills matched; ${preferredMatches} preferred skills matched; ${idleHours.toFixed(1)} idle hours`,
      } satisfies RoutingDecision;
    })
    .sort((left, right) => right.score - left.score || left.agentId.localeCompare(right.agentId));

  return scored[0] ?? null;
}
