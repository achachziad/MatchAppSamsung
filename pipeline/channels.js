// Associe chaque match aux programmes TV qui le diffusent en direct.

// Le programme doit commencer entre 30 min avant et 10 min après le coup d'envoi (sinon : rediffusion).
const BEFORE_MS = 30 * 60_000;
const AFTER_MS = 10 * 60_000;

// Mots qui ne distinguent pas un club.
const GENERIC = new Set([
  "fc", "cf", "ac", "sc", "afc", "as", "rc", "sv", "fk", "sk", "ud", "kv", "osc", "ogc", "vfb", "fsv",
  "tsg", "rcd", "rb", "cd", "sd", "ss", "ssc", "pae", "club", "clube", "de", "la", "le", "les", "of", "the",
]);

// Noms français du guide → forme proche de l'API, quand le préfixe commun ne suffit pas.
const ALIASES = {
  come: "como",
  bruges: "brugge",
  cologne: "koln",
  mayence: "mainz",
  hambourg: "hamburger",
  chakhtior: "shakhtar",
  munich: "munchen",
  francfort: "frankfurt",
  naples: "napoli",
  rome: "roma",
  sg: "saint germain",
};

export function tokens(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .flatMap((t) => (ALIASES[t] ?? t).split(" "))
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !GENERIC.has(t));
}

// "barcelone" ~ "barcelona", "inter" ~ "internazionale" : préfixe commun d'au moins 5 lettres.
function similar(a, b) {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 5 || (i >= 4 && i === Math.min(a.length, b.length));
}

function teamScore(guideName, apiNames) {
  const apiTokens = new Set(apiNames.flatMap(tokens));
  return tokens(guideName).filter((t) => [...apiTokens].some((a) => similar(t, a))).length;
}

// "Football : Ligue 1 McDonald's | Lens / Paris FC" → ["Lens", "Paris FC"]
function teamsFromTitle(title) {
  const part = title.split("|").pop();
  const sides = part.split(" / ");
  return sides.length === 2 ? sides.map((s) => s.trim()) : null;
}

const isLiveFootball = (p) => p.categories.includes("Football");

// Les déclinaisons numérotées (Canal+ Live 3, beIN SPORTS MAX 5, Ligue 1+ 5) passent après les chaînes principales.
function channelRank(name) {
  return /\b(Live|MAX) \d+$|\+ \d+$/.test(name) ? 1 : 0;
}

export function attachChannels(matches, { channels, programmes }) {
  const found = new Map(matches.map((m) => [m, new Set()]));

  for (const p of programmes) {
    if (!isLiveFootball(p)) continue;
    const teams = teamsFromTitle(p.title);
    if (!teams) continue;
    const start = Date.parse(p.start);

    let best = null;
    let bestScore = 0;
    let tie = false;
    for (const m of matches) {
      const kickoff = Date.parse(m.kickoff);
      if (start < kickoff - BEFORE_MS || start > kickoff + AFTER_MS) continue;
      const home = teamScore(teams[0], m.names.home);
      const away = teamScore(teams[1], m.names.away);
      if (home === 0 || away === 0) continue;
      if (home + away > bestScore) [best, bestScore, tie] = [m, home + away, false];
      else if (home + away === bestScore) tie = true;
    }
    if (best && !tie) found.get(best).add(channels[p.channel] ?? p.channel);
  }

  return matches.map((m) => ({
    ...m,
    channels: [...found.get(m)].sort((a, b) => channelRank(a) - channelRank(b) || a.localeCompare(b, "fr", { numeric: true })),
  }));
}
