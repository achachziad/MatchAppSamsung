// Génère dist/matchs.json : matchs football-data.org + chaînes trouvées dans le guide XMLTV.
// Lancé par GitHub Actions (voir .github/workflows/update.yml), ou en local : npm run build

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fetchFootballData, parseFootballData } from "./footballData.js";
import { parseXmltv, XMLTV_URL } from "./xmltv.js";
import { attachChannels } from "./channels.js";
import { dateWindow, guideDay } from "./dates.js";

const CACHE_FILE = ".cache/xmltv_fr.xml.gz";
const OUT_FILE = "dist/matchs.json";

// Un seul téléchargement du guide par jour (service bénévole) : on réutilise le fichier du jour s'il existe.
async function loadGuide(now) {
  if (existsSync(CACHE_FILE) && guideDay(statSync(CACHE_FILE).mtime) === guideDay(now)) {
    console.log("Guide TV : cache du jour");
  } else {
    console.log(`Guide TV : téléchargement de ${XMLTV_URL}`);
    const res = await fetch(XMLTV_URL);
    if (!res.ok) throw new Error(`xmltvfr : HTTP ${res.status}`);
    mkdirSync(".cache", { recursive: true });
    writeFileSync(CACHE_FILE, Buffer.from(await res.arrayBuffer()));
  }
  return parseXmltv(gunzipSync(readFileSync(CACHE_FILE)).toString("utf8"));
}

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN manquant (fichier .env ou secret GitHub)");

  const now = new Date();
  const window = dateWindow(now);
  const matches = parseFootballData(await fetchFootballData({ token, ...window }));
  console.log(`football-data : ${matches.length} matchs du ${window.dateFrom} au ${window.dateTo}`);

  // Sans guide TV, on publie quand même les matchs (« Chaîne non communiquée »).
  let guide = { channels: {}, programmes: [] };
  try {
    guide = await loadGuide(now);
  } catch (err) {
    console.warn(`Guide TV indisponible : ${err.message}`);
  }

  const result = attachChannels(matches, guide).map(({ names, ...m }) => m);
  const withChannel = result.filter((m) => m.channels.length).length;
  console.log(`Chaînes trouvées : ${withChannel}/${result.length}`);

  mkdirSync("dist", { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: now.toISOString(), matches: result }, null, 2) + "\n");
  console.log(`Écrit : ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
