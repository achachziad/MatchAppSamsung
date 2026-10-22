import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFootballData } from "../../pipeline/footballData.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/football-data.json", import.meta.url), "utf8"));
const apiMatch = (overrides = {}) => ({
  id: 1,
  utcDate: "2026-10-21T19:00:00Z",
  status: "TIMED",
  competition: { code: "FL1", name: "Ligue 1" },
  homeTeam: { name: "Paris Saint-Germain FC", shortName: "PSG" },
  awayTeam: { name: "Olympique de Marseille", shortName: "Marseille" },
  score: { fullTime: { home: null, away: null } },
  ...overrides,
});

test("convertit un match terminé au modèle interne", () => {
  const raw = fixture.matches.find((m) => m.homeTeam.name === "Como 1907");
  const como = parseFootballData(fixture).find((m) => m.home === "Como 1907");
  assert.deepEqual(como, {
    id: `fd-${raw.id}`,
    sport: "football",
    competition: "Ligue des champions",
    home: "Como 1907",
    away: "Man United",
    kickoff: "2026-10-21T16:45:00Z",
    channels: [],
    status: "finished",
    score: { home: 4, away: 1 },
    names: { home: ["Como 1907"], away: ["Manchester United FC", "Man United"] },
  });
});

test("garde tous les matchs de la fixture", () => {
  assert.equal(parseFootballData(fixture).length, fixture.matches.length);
});

test("match en cours : statut live avec le score actuel", () => {
  const real = parseFootballData(fixture).find((m) => m.home === "Real Madrid");
  assert.equal(real.status, "live");
  assert.deepEqual(real.score, { home: 2, away: 0 });
});

test("match à venir : pas de score", () => {
  const [m] = parseFootballData({ matches: [apiMatch()] });
  assert.equal(m.status, "scheduled");
  assert.equal(m.score, null);
});

test("noms des compétitions en français", () => {
  const names = ["WC", "EC", "FL1", "CL", "PL", "PD", "BL1"].map(
    (code) => parseFootballData({ matches: [apiMatch({ competition: { code } })] })[0].competition,
  );
  assert.deepEqual(names, ["Coupe du monde", "Euro", "Ligue 1", "Ligue des champions", "Premier League", "LaLiga", "Bundesliga"]);
});

test("statuts reportés, suspendus et annulés → postponed", () => {
  for (const status of ["POSTPONED", "SUSPENDED", "CANCELLED"]) {
    assert.equal(parseFootballData({ matches: [apiMatch({ status })] })[0].status, "postponed");
  }
});

test("réponse vide → liste vide", () => {
  assert.deepEqual(parseFootballData({ matches: [] }), []);
});

test("réponse malformée → erreur explicite", () => {
  for (const bad of [null, {}, { matches: "x" }, { message: "Your API token is invalid." }]) {
    assert.throws(() => parseFootballData(bad), /football-data/);
  }
});

test("un match incomplet est ignoré, pas les autres", () => {
  const matches = parseFootballData({ matches: [apiMatch({ homeTeam: null }), apiMatch({ id: 2 })] });
  assert.deepEqual(matches.map((m) => m.id), ["fd-2"]);
});
