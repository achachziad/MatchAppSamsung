import { test } from "node:test";
import assert from "node:assert/strict";
import { parisDate, dateWindow } from "../../pipeline/dates.js";

test("date de Paris : après minuit à Paris mais encore la veille en UTC", () => {
  assert.equal(parisDate(new Date("2026-10-21T22:30:00Z")), "2026-10-22");
});

test("date de Paris : avant minuit à Paris", () => {
  assert.equal(parisDate(new Date("2026-10-21T21:30:00Z")), "2026-10-21");
});

// dateTo est EXCLUSIF côté football-data.org (vérifié le 21/10/2026 : 22→23 ne renvoie pas les matchs du 23).
test("fenêtre : de la veille à après-demain inclus, heure de Paris", () => {
  assert.deepEqual(dateWindow(new Date("2026-10-21T10:00:00Z")), { dateFrom: "2026-10-20", dateTo: "2026-10-24" });
});

test("fenêtre : changement de mois et heure d'hiver", () => {
  assert.deepEqual(dateWindow(new Date("2026-10-31T23:30:00Z")), { dateFrom: "2026-10-31", dateTo: "2026-11-04" });
});
