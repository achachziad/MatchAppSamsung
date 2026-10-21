const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

// Date calendaire à Paris, au format YYYY-MM-DD.
export function parisDate(date) {
  return PARIS.format(date);
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Matchs publiés : de la veille à après-demain (heure de Paris), pour que la télé
// trouve « aujourd'hui » et « demain » même si le fichier a quelques heures de retard.
// Attention : dateTo est exclusif côté football-data.org.
export function dateWindow(now) {
  const today = parisDate(now);
  return { dateFrom: addDays(today, -1), dateTo: addDays(today, 3) };
}

// Le guide xmltvfr.fr est régénéré vers 02h00 : on considère qu'une « journée de guide » commence à 04h00.
export function guideDay(date) {
  return parisDate(new Date(date.getTime() - 4 * 3600_000));
}
