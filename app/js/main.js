// Démarrage, rafraîchissement, cache et télécommande.
(function () {
  "use strict";

  var REFRESH_MS = 30 * 60 * 1000;
  var RETRY_MS = 2 * 60 * 1000; // après une erreur réseau
  var CACHE_KEY = "matchs-du-jour:last";
  var KEY = { UP: 38, DOWN: 40, BACK: 10009, ESCAPE: 27, BACKSPACE: 8 };

  var list = document.getElementById("list");
  var banner = document.getElementById("banner");
  var clock = document.getElementById("clock");

  var data = null; // { generatedAt, matches }
  var offline = false;
  var rows = [];
  var focusIndex = 0;
  var timer = null;

  // --- Cache localStorage (toujours dans un try/catch) ---

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? Source.parsePayload(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      // stockage plein ou indisponible : on continue sans cache
    }
  }

  // --- Affichage ---

  function focusedId() {
    var row = rows[focusIndex];
    return row ? row.getAttribute("data-id") : null;
  }

  function setFocus(index) {
    if (!rows.length) return;
    focusIndex = Math.max(0, Math.min(rows.length - 1, index));
    rows.forEach(function (r, i) {
      r.classList.toggle("focused", i === focusIndex);
    });
    var row = rows[focusIndex];
    row.focus({ preventScroll: true });
    // Premier match d'une section : on remonte tout en haut pour voir le titre du jour.
    if (focusIndex === 0) list.scrollTop = 0;
    else row.scrollIntoView({ block: "center" });
  }

  function render() {
    var now = new Date();
    var keepId = focusedId();
    if (!data) return;

    var stale = Matches.isStale(data.generatedAt, now);
    Render.renderBanner(
      banner,
      offline || stale ? "Données du " + (data.generatedAt ? Matches.formatDataDate(data.generatedAt) : "?") +
        (offline ? " — pas de connexion" : "") : "",
    );

    rows = Render.renderSections(list, Matches.buildSections(data.matches, now));
    var index = 0;
    rows.forEach(function (r, i) {
      if (r.getAttribute("data-id") === keepId) index = i;
    });
    setFocus(index);
  }

  function updateClock() {
    clock.textContent = Matches.formatTime(new Date().toISOString());
  }

  // --- Données ---

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(refresh, ms);
  }

  function refresh() {
    Source.fetchMatches().then(function (payload) {
      data = payload;
      offline = false;
      writeCache(payload);
      render();
      schedule(REFRESH_MS);
    }).catch(function () {
      offline = true;
      if (!data) data = readCache();
      if (data) render();
      else Render.renderMessage(list, "Impossible de charger les matchs. Vérifiez que la télé est connectée à internet. Nouvel essai dans 2 minutes.");
      schedule(RETRY_MS);
    });
  }

  // --- Télécommande ---

  function exitApp() {
    if (typeof tizen !== "undefined" && tizen.application) {
      tizen.application.getCurrentApplication().exit();
    }
    // Navigateur de PC : pas de sortie possible, on ne fait rien.
  }

  document.addEventListener("keydown", function (e) {
    switch (e.keyCode) {
      case KEY.UP:
        setFocus(focusIndex - 1);
        e.preventDefault();
        break;
      case KEY.DOWN:
        setFocus(focusIndex + 1);
        e.preventDefault();
        break;
      case KEY.BACK:
      case KEY.ESCAPE:
      case KEY.BACKSPACE:
        exitApp();
        e.preventDefault();
        break;
    }
  });

  // Retour sur l'appli après une mise en veille ou un changement d'appli : on rafraîchit.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });

  // --- Démarrage ---

  updateClock();
  setInterval(updateClock, 15000);
  // Toutes les minutes : le passage minuit/04h00 et la mention « Données du » restent justes sans réseau.
  setInterval(render, 60000);

  data = readCache();
  if (data) render();
  refresh();
})();
