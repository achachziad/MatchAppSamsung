import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadAppScript } from "./helpers/loadAppScript.js";

loadAppScript("matches.js");
const { formatTime, formatDataDate, buildSections } = globalThis.Matches;

const fixture = JSON.parse(readFileSync(new URL("./fixtures/matchs.json", import.meta.url), "utf8"));
const match = (overrides = {}) => ({
  id: "x",
  sport: "football",
  competition: "Ligue 1",
  home: "PSG",
  away: "Marseille",
  kickoff: "2026-10-21T19:00:00Z",
  channels: ["Ligue 1+"],
  status: "scheduled",
  score: null,
  ...overrides,
});
const allViews = (sections) => sections.flatMap((s) => s.groups.flatMap((g) => g.matches));

test("heure de Paris en été (UTC+2)", () => {
  assert.equal(formatTime("2026-10-21T19:00:00Z"), "21:00");
});

test("heure de Paris après le passage à l'heure d'hiver (UTC+1)", () => {
  assert.equal(formatTime("2026-10-25T19:45:00Z"), "20:45");
});

test("date des données affichée en JJ/MM HH:MM, heure de Paris", () => {
  assert.equal(formatDataDate("2026-10-21T23:48:59.495Z"), "22/10 01:48");
});

test("deux sections : aujourd'hui puis demain, avec la date en toutes lettres", () => {
  const sections = buildSections(fixture.matches, new Date("2026-10-23T08:00:00Z"));
  assert.deepEqual(
    sections.map((s) => [s.title, s.dateLabel]),
    [["Aujourd'hui", "vendredi 23 octobre"], ["Demain", "samedi 24 octobre"]],
  );
});

test("ne garde que les matchs d'aujourd'hui et de demain", () => {
  const [today, tomorrow] = buildSections(fixture.matches, new Date("2026-10-23T08:00:00Z"));
  const count = (s) => s.groups.reduce((n, g) => n + g.matches.length, 0);
  assert.equal(count(today), 4);
  assert.equal(count(tomorrow), 15);
});

test("groupes dans l'ordre fixe des compétitions, matchs triés par heure", () => {
  const [, tomorrow] = buildSections(fixture.matches, new Date("2026-10-23T08:00:00Z"));
  const order = tomorrow.groups.map((g) => g.competition);
  const expected = ["Ligue 1", "Ligue des champions", "Premier League", "LaLiga", "Bundesliga"].filter((c) => order.includes(c));
  assert.deepEqual(order, expected);
  for (const g of tomorrow.groups) {
    const times = g.matches.map((m) => m.time);
    assert.deepEqual(times, [...times].sort());
  }
});

test("aucun match aujourd'hui : groupes vides et message", () => {
  const [today, tomorrow] = buildSections(fixture.matches, new Date("2026-10-22T08:00:00Z"));
  assert.deepEqual(today.groups, []);
  assert.equal(today.emptyText, "Aucun match aujourd'hui");
  assert.ok(tomorrow.groups.length > 0);
});

test("liste vide : deux sections vides avec leur message", () => {
  const sections = buildSections([], new Date("2026-10-22T08:00:00Z"));
  assert.deepEqual(sections.map((s) => s.emptyText), ["Aucun match aujourd'hui", "Aucun match demain"]);
});

test("match après minuit : reste dans la soirée de la veille avec « +1 jour »", () => {
  const [today] = buildSections([match({ kickoff: "2026-10-21T22:30:00Z" })], new Date("2026-10-21T10:00:00Z"));
  const [view] = today.groups[0].matches;
  assert.equal(view.time, "00:30");
  assert.equal(view.nextDay, true);
});

test("match à 05h00 : appartient au lendemain, sans « +1 jour »", () => {
  const [today, tomorrow] = buildSections([match({ kickoff: "2026-10-22T03:00:00Z" })], new Date("2026-10-21T10:00:00Z"));
  assert.deepEqual(today.groups, []);
  assert.equal(tomorrow.groups[0].matches[0].nextDay, false);
});

test("à 01h30 du matin, « aujourd'hui » est encore la soirée de la veille", () => {
  const [today] = buildSections([match()], new Date("2026-10-21T23:30:00Z"));
  assert.equal(today.dateLabel, "mercredi 21 octobre");
  assert.equal(today.groups[0].matches.length, 1);
});

test("match terminé : score et mention « Terminé »", () => {
  const [today] = buildSections(fixture.matches, new Date("2026-10-21T10:00:00Z"));
  const como = allViews([today]).find((m) => m.home === "Como 1907");
  assert.equal(como.score, "4 - 1");
  assert.equal(como.label, "Terminé");
  assert.equal(como.status, "finished");
});

test("match en cours : score et « En direct »", () => {
  const [today] = buildSections([match({ status: "live", score: { home: 1, away: 0 } })], new Date("2026-10-21T10:00:00Z"));
  const [view] = today.groups[0].matches;
  assert.deepEqual([view.score, view.label], ["1 - 0", "En direct"]);
});

test("match à venir : heure, pas de score ni de mention", () => {
  const [today] = buildSections([match()], new Date("2026-10-21T10:00:00Z"));
  const [view] = today.groups[0].matches;
  assert.deepEqual([view.time, view.score, view.label], ["21:00", null, null]);
});

test("match reporté : mention « Reporté »", () => {
  const [today] = buildSections([match({ status: "postponed" })], new Date("2026-10-21T10:00:00Z"));
  assert.equal(today.groups[0].matches[0].label, "Reporté");
});

test("match terminé sans score connu : pas de score inventé", () => {
  const [today] = buildSections([match({ status: "finished", score: null })], new Date("2026-10-21T10:00:00Z"));
  const [view] = today.groups[0].matches;
  assert.deepEqual([view.score, view.label], [null, "Terminé"]);
});

test("chaînes jointes, ou « Chaîne non communiquée »", () => {
  const [today] = buildSections(
    [match({ id: "a", channels: ["Canal+ Sport", "Canal+ Live 3"] }), match({ id: "b", channels: [], kickoff: "2026-10-21T20:00:00Z" })],
    new Date("2026-10-21T10:00:00Z"),
  );
  assert.deepEqual(today.groups[0].matches.map((m) => m.channels), ["Canal+ Sport · Canal+ Live 3", "Chaîne non communiquée"]);
});

test("données périmées au-delà de 3 h", () => {
  const { isStale } = globalThis.Matches;
  const now = new Date("2026-10-22T12:00:00Z");
  assert.equal(isStale("2026-10-22T09:30:00Z", now), false);
  assert.equal(isStale("2026-10-22T08:59:00Z", now), true);
  assert.equal(isStale(null, now), true);
});

test("Coupe du monde et Euro passent avant les championnats", () => {
  const [today] = buildSections(
    [match({ id: "a", competition: "Ligue 1" }), match({ id: "b", competition: "Euro" }), match({ id: "c", competition: "Coupe du monde" })],
    new Date("2026-10-21T10:00:00Z"),
  );
  assert.deepEqual(today.groups.map((g) => g.competition), ["Coupe du monde", "Euro", "Ligue 1"]);
});
