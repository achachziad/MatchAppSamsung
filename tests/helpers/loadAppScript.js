// Les scripts de app/js/ sont des scripts classiques (pas de modules ES, voir CLAUDE.md) qui
// exposent un objet global. On les exécute dans le contexte de Node pour les tester.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadAppScript(relativePath) {
  const url = new URL(`../../app/js/${relativePath}`, import.meta.url);
  vm.runInThisContext(readFileSync(url, "utf8"), { filename: url.pathname });
}
