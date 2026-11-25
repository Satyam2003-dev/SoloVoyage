/** Trip model: preparation stages, milestones and progress. Shared by the planner and the dashboard. */
import { addDays, daysBetween, parseDate, percent, plural, today, uid } from "./utils.js";

export const TRIP_TYPES = ["Leisure", "City break", "Backpacking", "Business", "Study or volunteering", "Outdoors and adventure", "Visiting people", "Other"];

/* Each task is [title, related guide id]. */
export const STAGES = [
  { id: "research", name: "Research", icon: "compass", when: "As soon as you decide to go", tasks: [["Research the destination", "research-your-destination"], ["Learn local customs and laws", "research-your-destination"], ["Check the weather and climate", "check-weather-and-climate"], ["Research local transport", "research-public-transport"], ["Compare places to stay", "read-solo-traveler-reviews"], ["Check current safety advice", "choose-safe-neighborhoods"]] },
  { id: "documentation", name: "Documentation", icon: "file-text", when: "At least 8 weeks before", tasks: [["Check passport validity", "check-passport-expiry"], ["Research visa and entry rules", "check-passport-expiry"], ["Gather identification", "copy-important-documents"], ["Arrange travel insurance", "get-the-right-travel-insurance"], ["Save reservation details offline", "book-first-night"], ["Make digital and paper copies", "document-everything"]] },
  { id: "finance", name: "Financial preparation", icon: "wallet", when: "At least 3 weeks before", tasks: [["Plan a budget", null], ["Choose payment methods and a backup card", "hide-a-backup-card"], ["Set aside emergency funds", "keep-emergency-cash-hidden"], ["Tell your bank and save its numbers", "tell-your-bank"], ["Turn on transaction alerts", "use-indoor-atms"]] },
  { id: "packing", name: "Packing", icon: "backpack", when: "During the last week", tasks: [["Pack clothing", "pack-light-and-smart"], ["Pack documents", "copy-important-documents"], ["Pack electronics and chargers", "phone-charging-options"], ["Pack medicines and personal essentials", "pack-first-aid-kit"], ["Pack safety equipment suited to the trip", "whistle-or-personal-alarm"]] },
  { id: "departure", name: "Departure", icon: "plane-takeoff", when: "The day before", tasks: [["Confirm transport", "book-airport-transfers"], ["Confirm accommodation", "book-first-night"], ["Share your plan with a trusted contact", "share-your-plans"], ["Check essential documents", "valuables-in-carry-on"], ["Review emergency information", "know-local-emergency-numbers"]] },
  { id: "during", name: "During travel", icon: "footprints", when: "While you are away", tasks: [["Stay aware of your surroundings", "trust-your-gut"], ["Protect your valuables", "divide-your-money"], ["Keep an eye on bookings and arrangements", "share-your-plans"], ["Keep important contacts within reach", "save-important-numbers"]] },
];

export function defaultTasks() {
  return STAGES.flatMap((stage) => stage.tasks.map(([title, guide], i) => ({ id: `s-${stage.id}-${i}`, group: stage.id, title, guide, done: false, custom: false })));
}

export function newTrip(details) {
  return { id: uid("trip"), ...details, tasks: defaultTasks(), createdAt: Date.now() };
}

export const tripTitle = (trip) => trip.name || trip.destination || "Untitled trip";

export function tripProgress(trip) {
  const done = trip.tasks.filter((t) => t.done).length;
  return { done, total: trip.tasks.length, left: trip.tasks.length - done, value: percent(done, trip.tasks.length) };
}

/** A plain description of where the dates stand. */
export function tripTiming(trip) {
  const depart = parseDate(trip.depart);
  const ret = parseDate(trip.ret);
  if (!depart) return { text: "No departure date set", phase: "undated" };
  const until = daysBetween(today(), depart);
  if (until > 0) return { text: `${plural(until, "day")} until departure`, phase: "before" };
  if (until === 0) return { text: "You leave today", phase: "before" };
  if (!ret) return { text: `Departure was ${plural(-until, "day")} ago`, phase: "after-departure" };
  if (daysBetween(today(), ret) >= 0) return { text: `Day ${-until + 1} of your trip`, phase: "during" };
  return { text: "These trip dates have passed", phase: "past" };
}

/** Suggested dates worked back from departure. They are suggestions, not deadlines. */
export function milestones(trip) {
  const depart = parseDate(trip.depart);
  if (!depart) return [];
  const items = [
    ["Documents and insurance", addDays(depart, -56), ["documentation"]],
    ["Money and bank", addDays(depart, -21), ["finance"]],
    ["Packing", addDays(depart, -7), ["packing"]],
    ["Final checks", addDays(depart, -1), ["departure"]],
    ["Departure", depart, []],
  ];
  const ret = parseDate(trip.ret);
  if (ret) items.push(["Return", ret, []]);
  return items.map(([name, date, groups]) => {
    const tasks = trip.tasks.filter((t) => groups.includes(t.group));
    const complete = tasks.length > 0 && tasks.every((t) => t.done);
    const gap = daysBetween(today(), date);
    const status = complete ? "done" : gap < 0 ? (tasks.length ? "overdue" : "passed") : gap === 0 ? "today" : "upcoming";
    return { name, date, status, gap };
  });
}
