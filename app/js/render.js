// Affichage (DOM uniquement). Les données arrivent déjà formatées par Matches.buildSections.
// Script classique : expose globalThis.Render.
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderCenter(m) {
    var center = el("div", "center");
    if (m.nextDay) center.appendChild(el("div", "next-day", "+1 jour"));
    center.appendChild(el("div", m.score ? "score" : "time", m.score || m.time));
    if (m.label) center.appendChild(el("div", "label label-" + m.status, m.label));
    return center;
  }

  function renderMatch(m) {
    var row = el("div", "match status-" + m.status);
    row.setAttribute("data-id", m.id);
    row.tabIndex = -1;
    var line = el("div", "line");
    line.appendChild(el("div", "team home", m.home));
    line.appendChild(renderCenter(m));
    line.appendChild(el("div", "team away", m.away));
    row.appendChild(line);
    row.appendChild(el("div", "channels" + (m.channels === "Chaîne non communiquée" ? " unknown" : ""), m.channels));
    return row;
  }

  // Remplace le contenu de la liste. Renvoie les lignes de match, dans l'ordre de navigation.
  function renderSections(list, sections) {
    list.textContent = "";
    var rows = [];
    sections.forEach(function (s) {
      var section = el("section", "day");
      var title = el("h1", "day-title");
      title.appendChild(el("span", "day-name", s.title));
      title.appendChild(el("span", "day-date", s.dateLabel));
      section.appendChild(title);
      if (!s.groups.length) section.appendChild(el("p", "message", s.emptyText));
      s.groups.forEach(function (g) {
        section.appendChild(el("h2", "competition", g.competition));
        g.matches.forEach(function (m) {
          var row = renderMatch(m);
          rows.push(row);
          section.appendChild(row);
        });
      });
      list.appendChild(section);
    });
    return rows;
  }

  function renderMessage(list, text) {
    list.textContent = "";
    list.appendChild(el("p", "message error", text));
  }

  function renderBanner(banner, text) {
    banner.textContent = text || "";
    banner.hidden = !text;
  }

  globalThis.Render = { renderSections: renderSections, renderMessage: renderMessage, renderBanner: renderBanner };
})();
