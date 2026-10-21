// Lecture minimale d'un guide XMLTV (format de xmltvfr.fr). Pas de dépendance : regex sur le texte.

export const XMLTV_URL = "https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e] ?? all;
    })
    .trim();
}

// "20261021210000 +0200" → "2026-10-21T19:00:00Z"
export function parseXmltvDate(value) {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-])(\d\d)(\d\d)$/.exec(value ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  const offset = (sign === "+" ? 1 : -1) * (Number(oh) * 60 + Number(om));
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - offset * 60_000;
  return new Date(utc).toISOString().replace(".000Z", "Z");
}

export function parseXmltv(xml) {
  const channels = {};
  for (const [, id, body] of xml.matchAll(/<channel id="([^"]+)">([\s\S]*?)<\/channel>/g)) {
    const name = /<display-name[^>]*>([\s\S]*?)<\/display-name>/.exec(body);
    if (name) channels[id] = decode(name[1]);
  }

  const programmes = [];
  for (const [, attrs, body] of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const start = parseXmltvDate(/\bstart="([^"]*)"/.exec(attrs)?.[1]);
    const channel = /\bchannel="([^"]*)"/.exec(attrs)?.[1];
    const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(body)?.[1];
    if (!start || !channel || !title) continue;
    programmes.push({
      channel,
      start,
      title: decode(title),
      subTitle: decode(/<sub-title[^>]*>([\s\S]*?)<\/sub-title>/.exec(body)?.[1] ?? ""),
      categories: [...body.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map((c) => decode(c[1])),
    });
  }
  return { channels, programmes };
}
