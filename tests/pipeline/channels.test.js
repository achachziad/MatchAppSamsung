import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFootballData } from "../../pipeline/footballData.js";
import { parseXmltv } from "../../pipeline/xmltv.js";
import { attachChannels } from "../../pipeline/channels.js";

const matches = parseFootballData(
  JSON.parse(readFileSync(new URL("../fixtures/football-data.json", import.meta.url), "utf8")),
);
const epg = parseXmltv(readFileSync(new URL("../fixtures/xmltv.xml", import.meta.url), "utf8"));
const withChannels = attachChannels(matches, epg);
const channelsOf = (home) => withChannels.find((m) => m.home === home).channels;

// Attendus relevés à la main dans le guide xmltvfr.fr du 21/10/2026.
const expected = {
  "Como 1907": ["Canal+ Sport", "Canal+ Live 3"],
  "Lille": ["Canal+ Foot", "Canal+ Live 2"],
  "Club Brugge": ["Canal+", "Canal+ Live 1"],
  "Bayern": ["Canal+ Foot", "Canal+ Live 2"],
  "Real Madrid": ["Canal+ Sport", "Canal+ Live 3"],
  "Inter": ["Canal+ Live 4"],
  "Aston Villa": ["Canal+ Live 5"],
  "Real Betis": ["Canal+ Live 6"],
  "Sporting CP": ["Canal+ Live 7"],
  "Levante": [],
  "Stuttgart": ["beIN SPORTS MAX 10"],
  "Dortmund": ["beIN SPORTS 2"],
  "Augsburg": ["beIN SPORTS MAX 5"],
  "1. FC Köln": ["beIN SPORTS MAX 8"],
  "Chelsea": ["Canal+ Foot", "Canal+ Premier League", "Canal+ Live 6"],
  "Atleti": ["DAZN 1"],
  "RC Lens": ["Ligue 1+ 3"],
  "Marseille": ["DAZN 1", "Ligue 1+ 5"],
  "Barça": ["DAZN 1"],
};

for (const [home, channels] of Object.entries(expected)) {
  test(`chaînes réelles : ${home}`, () => {
    assert.deepEqual(channelsOf(home), channels);
  });
}

// Cas construits à la main
const match = (home, away, kickoff, names = {}) => ({
  id: home, sport: "football", competition: "Premier League", home, away, kickoff,
  channels: [], status: "scheduled", score: null,
  names: { home: names.home ?? [home], away: names.away ?? [away] },
});
const guide = (...programmes) => ({
  channels: { a: "Chaîne A", b: "Chaîne B" },
  programmes: programmes.map(([channel, start, title, categories = ["Football"]]) => ({
    channel, start, title, subTitle: "", categories,
  })),
});

test("une rediffusion hors de la fenêtre du coup d'envoi est ignorée", () => {
  const [m] = attachChannels(
    [match("Arsenal", "Everton", "2026-10-24T14:00:00Z")],
    guide(["a", "2026-10-24T20:00:00Z", "Arsenal / Everton"], ["b", "2026-10-24T13:55:00Z", "Arsenal / Everton"]),
  );
  assert.deepEqual(m.channels, ["Chaîne B"]);
});

test("deux matchs de Manchester à la même heure : chacun sa chaîne", () => {
  const ms = attachChannels(
    [
      match("Man City", "Leeds", "2026-10-24T14:00:00Z", { home: ["Manchester City FC"] }),
      match("Man United", "Fulham", "2026-10-24T14:00:00Z", { home: ["Manchester United FC"] }),
    ],
    guide(["a", "2026-10-24T14:00:00Z", "Manchester City / Leeds"], ["b", "2026-10-24T14:00:00Z", "Manchester United / Fulham"]),
  );
  assert.deepEqual(ms.map((m) => m.channels), [["Chaîne A"], ["Chaîne B"]]);
});

test("une seule équipe reconnue ne suffit pas", () => {
  const [m] = attachChannels(
    [match("Arsenal", "Everton", "2026-10-24T14:00:00Z")],
    guide(["a", "2026-10-24T14:00:00Z", "Arsenal / Chelsea"]),
  );
  assert.deepEqual(m.channels, []);
});

test("les magazines et le football américain sont ignorés", () => {
  const [m] = attachChannels(
    [match("Arsenal", "Everton", "2026-10-24T14:00:00Z")],
    guide(
      ["a", "2026-10-24T14:00:00Z", "Arsenal / Everton", ["Sport", "Mag Football"]],
      ["b", "2026-10-24T14:00:00Z", "Arsenal / Everton", ["Football américain"]],
    ),
  );
  assert.deepEqual(m.channels, []);
});

test("match après minuit heure de Paris", () => {
  const [m] = attachChannels(
    [match("Arsenal", "Everton", "2026-10-21T22:30:00Z")],
    guide(["a", "2026-10-21T22:30:00Z", "Football : Premier League | Arsenal / Everton"]),
  );
  assert.deepEqual(m.channels, ["Chaîne A"]);
});

test("noms français du guide : Naples = Napoli", () => {
  const [m] = attachChannels(
    [match("Napoli", "Bodø/Glimt", "2026-10-20T19:00:00Z", { home: ["SSC Napoli", "Napoli"], away: ["FK Bodø/Glimt"] })],
    guide(["a", "2026-10-20T18:55:00Z", "Naples / FK Bodø/Glimt"]),
  );
  assert.deepEqual(m.channels, ["Chaîne A"]);
});

test("guide vide → chaînes vides, matchs intacts", () => {
  const ms = attachChannels([match("Arsenal", "Everton", "2026-10-24T14:00:00Z")], { channels: {}, programmes: [] });
  assert.deepEqual(ms[0].channels, []);
  assert.equal(ms[0].home, "Arsenal");
});
