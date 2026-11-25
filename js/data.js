/** Loads the JSON content files once per page and offers lookups. */

const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    const url = new URL(`../data/${name}.json`, import.meta.url);
    const request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`);
      return response.json();
    });
    request.catch(() => cache.delete(name));
    cache.set(name, request);
  }
  return cache.get(name);
}

let guideIndex;
export async function getGuides() {
  const { guides } = await load("guides");
  if (!guideIndex) guideIndex = { list: guides, byId: new Map(guides.map((g) => [g.id, g])) };
  return guideIndex;
}

let categoryIndex;
export async function getCategories() {
  const { categories } = await load("categories");
  if (!categoryIndex) categoryIndex = { list: categories, guides: categories.filter((c) => c.type === "guides"), byId: new Map(categories.map((c) => [c.id, c])) };
  return categoryIndex;
}

export const getChecklist = () => load("checklist");
export const getEmergency = () => load("emergency");
export const getDestinations = () => load("destinations");

export const guideUrl = (id) => `guide.html?id=${encodeURIComponent(id)}`;
export const guideNumber = (guide) => String(guide.number).padStart(3, "0");

export function wordCount(guide) {
  const parts = [guide.summary, guide.intro, guide.note, guide.warning, ...guide.actions.flatMap((a) => [a.title, a.text])];
  return parts.filter(Boolean).join(" ").split(/\s+/).length;
}

/** Reading time at 200 words a minute, never less than one minute. */
export const readingMinutes = (guide) => Math.max(1, Math.round(wordCount(guide) / 200));
