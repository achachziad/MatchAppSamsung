import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadAppScript } from "../helpers/loadAppScript.js";

loadAppScript("sources/githubPages.js");
const { parsePayload } = globalThis.GithubPagesSource;

const fixture = JSON.parse(readFileSync(new URL("../fixtures/matchs.json", import.meta.url), "utf8"));

test("lit le fichier publié", () => {
  const { generatedAt, matches } = parsePayload(fixture);
  assert.equal(generatedAt, "2026-10-21T23:48:59.495Z");
  assert.equal(matches.length, fixture.matches.length);
  assert.deepEqual(matches[0], fixture.matches[0]);
});

test("liste vide acceptée", () => {
  assert.deepEqual(parsePayload({ generatedAt: "2026-10-22T09:00:00Z", matches: [] }).matches, []);
});

test("réponse malformée → erreur", () => {
  for (const bad of [null, "texte", {}, { matches: {} }]) {
    assert.throws(() => parsePayload(bad), /matchs\.json/);
  }
});

test("un match incomplet est ignoré ; chaînes absentes → []", () => {
  const ok = { ...fixture.matches[0] };
  delete ok.channels;
  const { matches } = parsePayload({ generatedAt: null, matches: [{ id: "x", home: "A" }, ok, { ...ok, kickoff: "pas une date" }] });
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].channels, []);
});
