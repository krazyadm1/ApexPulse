export interface SeasonInfo {
  id: string;
  name: string;
  startDate: number; // epoch ms
  endDate: number;   // epoch ms
}

export const SEASONS: SeasonInfo[] = [
  { id: 's22_s1', name: 'Season 22 Split 1', startDate: 1731340800000, endDate: 1735574400000 },
  { id: 's22_s2', name: 'Season 22 Split 2', startDate: 1735574400000, endDate: 1739203200000 },
  { id: 's23_s1', name: 'Season 23 Split 1', startDate: 1739203200000, endDate: 1743436800000 },
  { id: 's23_s2', name: 'Season 23 Split 2', startDate: 1743436800000, endDate: 1747065600000 },
  { id: 's24_s1', name: 'Season 24 Split 1', startDate: 1747065600000, endDate: 1751299200000 },
  { id: 's24_s2', name: 'Season 24 Split 2', startDate: 1751299200000, endDate: 1755532800000 },
];

export function getCurrentSeason(): SeasonInfo | null {
  const now = Date.now();
  return SEASONS.find(s => now >= s.startDate && now < s.endDate) ?? SEASONS[SEASONS.length - 1];
}

export function getSeasonByDate(timestamp: number): SeasonInfo | null {
  return SEASONS.find(s => timestamp >= s.startDate && timestamp < s.endDate) ?? null;
}
