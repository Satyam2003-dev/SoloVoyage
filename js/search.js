/** Client-side search over every guide and emergency situation. */
import { getCategories, getEmergency, getGuides, guideNumber, guideUrl } from "./data.js";
import { cleanText } from "./utils.js";

export const MAX_QUERY = 80;

const STOP = new Set(["a", "an", "and", "are", "at", "be", "do", "for", "how", "i", "in", "is", "it", "my", "of", "on", "or", "the", "to", "what", "with", "your"]);
const normalize = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Split a query into lower-case search terms. Stop words go unless nothing else is left. */
export function parseQuery(query) {
  const words = normalize(cleanText(query, MAX_QUERY)).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const useful = words.filter((w) => !STOP.has(w));
  return [...new Set(useful.length ? useful : words)];
}

let index;
async function build() {
  const [{ list }, categories, emergency] = await Promise.all([getGuides(), getCategories(), getEmergency()]);
  const entry = (fields, extra) => ({ ...extra, fields: fields.map(([text, weight]) => ({ text: normalize(text), weight })) });
  index = list.map((g) => {
    const category = categories.byId.get(g.category);
    return entry(
      [
        [g.title, 12],
        [g.tags.join(" "), 7],
        [category.name, 4],
        [g.summary, 4],
        [g.intro, 2],
        [[g.note, g.warning, ...g.actions.flatMap((a) => [a.title, a.text])].filter(Boolean).join(" "), 1],
      ],
      { type: "guide", id: g.id, title: g.title, summary: g.summary, href: guideUrl(g.id), category: g.category, label: category.name, number: guideNumber(g), order: g.number, guide: g }
    );
  });
  for (const [i, s] of emergency.situations.entries()) {
    index.push(
      entry(
        [
          [s.title, 12],
          [s.summary, 4],
          [s.situation, 2],
          [[...s.priorities, ...s.actions, ...s.avoid].join(" "), 1],
        ],
        { type: "emergency", id: s.id, title: s.title, summary: s.summary, href: `emergency.html#${s.id}`, category: "emergency-center", label: "Emergency Center", number: "SOS", order: 200 + i }
      )
    );
  }
  return index;
}

function scoreTerm(entry, term) {
  let score = 0;
  for (const { text, weight } of entry.fields) {
    const at = text.indexOf(term);
    if (at < 0) continue;
    const wordStart = new RegExp(`(^|[^\\p{L}\\p{N}])${term}`, "u").test(text);
    score += wordStart ? weight : weight * 0.3;
  }
  return score;
}

/**
 * Search. Results contain every term; when none do, results with any term are returned and partial is true.
 * An empty query returns no results.
 */
export async function search(query, { category = "" } = {}) {
  const terms = parseQuery(query);
  if (!terms.length) return { results: [], terms, partial: false };
  const pool = (index || (await build())).filter((e) => !category || e.category === category);
  const scored = pool.map((entry) => {
    const scores = terms.map((t) => scoreTerm(entry, t));
    return { entry, hits: scores.filter(Boolean).length, score: scores.reduce((a, b) => a + b, 0) };
  });
  const sort = (a, b) => b.hits - a.hits || b.score - a.score || a.entry.order - b.entry.order;
  const all = scored.filter((s) => s.hits === terms.length).sort(sort);
  const chosen = all.length ? all : scored.filter((s) => s.hits).sort(sort);
  return { results: chosen.map((s) => s.entry), terms, partial: !all.length && chosen.length > 0 };
}

/** A short piece of body text around the first match, for result lists. */
export function snippet(entry, terms) {
  if (!entry.guide || terms.some((t) => normalize(entry.summary).includes(t))) return entry.summary;
  const body = [entry.guide.intro, ...entry.guide.actions.map((a) => a.text)].find((text) => terms.some((t) => normalize(text).includes(t)));
  return body || entry.summary;
}

export const SUGGESTIONS = ["passport", "taxi", "hotel room", "Wi-Fi", "street food", "lost phone", "insurance", "dating"];
