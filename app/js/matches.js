// Logique pure : regrouper, trier et formater les matchs pour l'affichage. Aucun accès au DOM.
// Script classique (pas de module ES) : expose globalThis.Matches.
(function () {
  "use strict";

  var TZ = "Europe/Paris";
  var DAY_START_HOURS = 4; // une « journée » va de 04h00 à 04h00, heure de Paris
  var COMPETITION_ORDER = ["Coupe du monde", "Euro", "Ligue 1", "Ligue des champions", "Premier League", "LaLiga", "Bundesliga"];
  var LABELS = { finished: "Terminé", live: "En direct", postponed: "Reporté" };

  var timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  var dayMonthFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  var isoDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var longDayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

  function formatTime(iso) {
    return timeFormat.format(new Date(iso));
  }

  // « Données du 22/10 01:48 »
  function formatDataDate(iso) {
    var d = new Date(iso);
    return dayMonthFormat.format(d) + " " + timeFormat.format(d);
  }

  function calendarDay(date) {
    return isoDayFormat.format(date);
  }

  function logicalDay(date) {
    return calendarDay(new Date(date.getTime() - DAY_START_HOURS * 3600000));
  }

  function addDays(isoDay, days) {
    var p = isoDay.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + days)).toISOString().slice(0, 10);
  }

  function dayLabel(isoDay) {
    return longDayFormat.format(new Date(isoDay + "T12:00:00Z"));
  }

  function competitionRank(name) {
    var i = COMPETITION_ORDER.indexOf(name);
    return i === -1 ? COMPETITION_ORDER.length : i;
  }

  function toView(m) {
    var kickoff = new Date(m.kickoff);
    var hasScore = (m.status === "finished" || m.status === "live") && m.score != null;
    return {
      id: m.id,
      home: m.home,
      away: m.away,
      time: formatTime(m.kickoff),
      nextDay: calendarDay(kickoff) !== logicalDay(kickoff),
      status: m.status,
      score: hasScore ? m.score.home + " - " + m.score.away : null,
      label: LABELS[m.status] || null,
      channels: m.channels && m.channels.length ? m.channels.join(" · ") : "Chaîne non communiquée",
    };
  }

  function groupByCompetition(matches) {
    var sorted = matches.slice().sort(function (a, b) {
      return (
        competitionRank(a.competition) - competitionRank(b.competition) ||
        a.competition.localeCompare(b.competition) ||
        Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
        a.home.localeCompare(b.home)
      );
    });
    var groups = [];
    sorted.forEach(function (m) {
      var last = groups[groups.length - 1];
      if (!last || last.competition !== m.competition) {
        last = { competition: m.competition, matches: [] };
        groups.push(last);
      }
      last.matches.push(toView(m));
    });
    return groups;
  }

  // [{ title, dateLabel, emptyText, groups: [{ competition, matches: [vue] }] }] pour aujourd'hui et demain.
  function buildSections(matches, now) {
    var today = logicalDay(now);
    var days = [
      { day: today, title: "Aujourd'hui", emptyText: "Aucun match aujourd'hui" },
      { day: addDays(today, 1), title: "Demain", emptyText: "Aucun match demain" },
    ];
    return days.map(function (d) {
      return {
        title: d.title,
        dateLabel: dayLabel(d.day),
        emptyText: d.emptyText,
        groups: groupByCompetition(
          matches.filter(function (m) {
            return logicalDay(new Date(m.kickoff)) === d.day;
          }),
        ),
      };
    });
  }

  // Le job tourne toutes les 30 min aux heures de match : au-delà de 3 h, on prévient l'utilisateur.
  var STALE_MS = 3 * 3600000;

  function isStale(generatedAt, now) {
    var t = Date.parse(generatedAt);
    return isNaN(t) || now.getTime() - t > STALE_MS;
  }

  globalThis.Matches = {
    formatTime: formatTime,
    formatDataDate: formatDataDate,
    buildSections: buildSections,
    isStale: isStale,
  };
})();
