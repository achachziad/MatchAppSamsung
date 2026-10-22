// Conversion de la réponse football-data.org (API v4, /v4/matches) vers le modèle interne.

export const API_URL = "https://api.football-data.org/v4/matches";
export const COMPETITIONS = {
  WC: "Coupe du monde",
  EC: "Euro",
  FL1: "Ligue 1",
  CL: "Ligue des champions",
  PL: "Premier League",
  PD: "LaLiga",
  BL1: "Bundesliga",
};

const STATUS = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  EXTRA_TIME: "live",
  PENALTY_SHOOTOUT: "live",
  FINISHED: "finished",
  AWARDED: "finished",
  POSTPONED: "postponed",
  SUSPENDED: "postponed",
  CANCELLED: "postponed",
};

export async function fetchFootballData({ token, dateFrom, dateTo }) {
  const url = `${API_URL}?competitions=${Object.keys(COMPETITIONS).join(",")}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  if (!res.ok) throw new Error(`football-data : HTTP ${res.status}`);
  return res.json();
}

export function parseFootballData(json) {
  if (!json || !Array.isArray(json.matches)) {
    throw new Error(`football-data : réponse inattendue${json?.message ? ` (${json.message})` : ""}`);
  }
  return json.matches.map(toMatch).filter(Boolean);
}

function toMatch(m) {
  const status = STATUS[m?.status];
  if (!m?.homeTeam?.name || !m?.awayTeam?.name || !m.utcDate || !status) return null;
  const full = m.score?.fullTime;
  const hasScore = Number.isInteger(full?.home) && Number.isInteger(full?.away);
  return {
    id: `fd-${m.id}`,
    sport: "football",
    competition: COMPETITIONS[m.competition?.code] ?? m.competition?.name ?? "",
    home: m.homeTeam.shortName || m.homeTeam.name,
    away: m.awayTeam.shortName || m.awayTeam.name,
    kickoff: m.utcDate.replace(/\.\d+Z$/, "Z"),
    channels: [],
    status,
    score: hasScore ? { home: full.home, away: full.away } : null,
    // Toutes les variantes de nom, pour l'association avec le guide TV. Retiré avant publication.
    names: { home: variants(m.homeTeam), away: variants(m.awayTeam) },
  };
}

function variants(team) {
  return [...new Set([team.name, team.shortName].filter(Boolean))];
}
