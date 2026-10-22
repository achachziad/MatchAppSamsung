// Source : matchs.json publié par le job GitHub Actions (voir pipeline/).
// Script classique : expose globalThis.GithubPagesSource.
(function () {
  "use strict";

  var DATA_URL = "https://achachziad.github.io/MatchAppSamsung/matchs.json";

  function isValidMatch(m) {
    return m && typeof m.id === "string" && typeof m.home === "string" && typeof m.away === "string" &&
      typeof m.kickoff === "string" && !isNaN(Date.parse(m.kickoff));
  }

  function parsePayload(json) {
    if (!json || typeof json !== "object" || !Array.isArray(json.matches)) {
      throw new Error("matchs.json : format inattendu");
    }
    return {
      generatedAt: json.generatedAt || null,
      matches: json.matches.filter(isValidMatch).map(function (m) {
        return Object.assign({}, m, { channels: Array.isArray(m.channels) ? m.channels : [] });
      }),
    };
  }

  function fetchMatches() {
    // Paramètre anti-cache : GitHub Pages et le navigateur de la télé gardent le fichier ~10 min.
    return fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("matchs.json : HTTP " + res.status);
      return res.json();
    }).then(parsePayload);
  }

  globalThis.GithubPagesSource = { fetchMatches: fetchMatches, parsePayload: parsePayload };
})();
