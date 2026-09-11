import type { ListTrialEvidenceAnchors } from "./listTrialEvidence";

export const LIST_TRIAL_REARM_NON_QUALIFYING_DAYS = 10;

export interface ListTrialQualifyingDay {
  date: string;
  score: number;
  anchors: ListTrialEvidenceAnchors;
}

export interface ListTrialEpisodeObservation {
  date: string;
  qualifyingDay: ListTrialQualifyingDay | null;
}

export interface ListTrialEpisode {
  triggerDate: string;
  triggerScore: number;
  triggerAnchors: ListTrialEvidenceAnchors;
  firstQualifyingDate: string;
  lastQualifyingDate: string;
  qualifyingDayCount: number;
}

function frozenAnchors(anchors: ListTrialEvidenceAnchors): ListTrialEvidenceAnchors {
  return {
    allTimeHigh: anchors.allTimeHigh,
    currentRollingLow: anchors.currentRollingLow && { ...anchors.currentRollingLow },
    priorSellingLow: anchors.priorSellingLow && { ...anchors.priorSellingLow },
  };
}

// Observations represent consecutive trading days, so cooldown counts trading sessions, not calendar days.
export function groupListTrialEpisodes(
  observations: ListTrialEpisodeObservation[],
  rearmNonQualifyingDays = LIST_TRIAL_REARM_NON_QUALIFYING_DAYS
): ListTrialEpisode[] {
  const episodes: ListTrialEpisode[] = [];
  let active: ListTrialEpisode | null = null;
  let consecutiveNonQualifyingDays = 0;

  for (const observation of observations) {
    const qualifyingDay = observation.qualifyingDay;
    if (active == null) {
      if (qualifyingDay != null) {
        active = {
          triggerDate: qualifyingDay.date,
          triggerScore: qualifyingDay.score,
          triggerAnchors: frozenAnchors(qualifyingDay.anchors),
          firstQualifyingDate: qualifyingDay.date,
          lastQualifyingDate: qualifyingDay.date,
          qualifyingDayCount: 1,
        };
      }
      continue;
    }

    if (qualifyingDay != null) {
      active.lastQualifyingDate = qualifyingDay.date;
      active.qualifyingDayCount++;
      consecutiveNonQualifyingDays = 0;
      continue;
    }

    consecutiveNonQualifyingDays++;
    if (consecutiveNonQualifyingDays >= rearmNonQualifyingDays) {
      episodes.push(active);
      active = null;
      consecutiveNonQualifyingDays = 0;
    }
  }

  if (active != null) episodes.push(active);
  return episodes;
}
