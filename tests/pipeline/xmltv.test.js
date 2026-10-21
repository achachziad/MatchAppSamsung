import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseXmltv, parseXmltvDate } from "../../pipeline/xmltv.js";

const fixture = readFileSync(new URL("../fixtures/xmltv.xml", import.meta.url), "utf8");

test("date XMLTV en heure d'été → UTC", () => {
  assert.equal(parseXmltvDate("20261021210000 +0200"), "2026-10-21T19:00:00Z");
});

test("date XMLTV en heure d'hiver → UTC", () => {
  assert.equal(parseXmltvDate("20261025211500 +0100"), "2026-10-25T20:15:00Z");
});

test("date XMLTV après minuit → jour précédent en UTC", () => {
  assert.equal(parseXmltvDate("20261022003000 +0200"), "2026-10-21T22:30:00Z");
});

test("date XMLTV invalide → null", () => {
  assert.equal(parseXmltvDate("pas une date"), null);
});

test("lit le nom affiché des chaînes", () => {
  const { channels } = parseXmltv(fixture);
  assert.equal(channels["CanalPlusLive4.fr"], "Canal+ Live 4");
  assert.equal(channels["beINSPORTS2.fr"], "beIN SPORTS 2");
});

test("lit les programmes avec titre, sous-titre et catégories", () => {
  const { programmes } = parseXmltv(fixture);
  const bruges = programmes.find((p) => p.channel === "CanalPlus.fr" && p.start === "2026-10-21T19:00:00Z");
  assert.deepEqual(bruges, {
    channel: "CanalPlus.fr",
    start: "2026-10-21T19:00:00Z",
    title: "Club Bruges / Lens",
    subTitle: "Ligue des champions - 3e journée",
    categories: ["Sport", "Football"],
  });
});

test("décode les entités XML", () => {
  const xml = `<tv><channel id="a"><display-name>L&apos;Équipe &amp; Co</display-name></channel>
    <programme start="20261021210000 +0200" stop="20261021230000 +0200" channel="a">
    <title lang="fr">Brighton &amp; Hove / Leeds</title><category>Football</category></programme></tv>`;
  const { channels, programmes } = parseXmltv(xml);
  assert.equal(channels.a, "L'Équipe & Co");
  assert.equal(programmes[0].title, "Brighton & Hove / Leeds");
  assert.equal(programmes[0].subTitle, "");
});

test("guide vide ou malformé → aucun programme, pas d'erreur", () => {
  for (const bad of ["", "<html>404</html>", "<tv><programme start=\"x\" channel=\"a\"></programme></tv>"]) {
    assert.deepEqual(parseXmltv(bad).programmes, []);
  }
});
