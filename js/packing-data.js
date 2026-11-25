/** Starter packing list and the document types whose status can be tracked. */
export const PACKING_CATEGORIES = [
  { id: "clothing", name: "Clothing", icon: "shirt", items: [["Tops", 4], ["Trousers or skirts", 2], ["Underwear and socks", 5], ["Warm or waterproof layer", 1], ["Comfortable walking shoes", 1], ["Sleepwear", 1]] },
  { id: "electronics", name: "Electronics", icon: "plug", items: [["Phone and charger", 1], ["Power bank (carry-on only)", 1], ["Travel adapter", 1], ["Spare charging cable", 1]] },
  { id: "documents", name: "Documents", icon: "file-text", items: [["Passport or ID", 1], ["Paper copies of documents", 2], ["Insurance details", 1], ["Emergency contact card", 1]] },
  { id: "personal-care", name: "Personal care", icon: "sparkle", items: [["Toothbrush and toothpaste", 1], ["Sunscreen", 1], ["Toiletries", 1], ["Quick-dry towel", 1]] },
  { id: "health", name: "Health essentials", icon: "pill", items: [["Prescription medicines and doctor's note", 1], ["Basic first aid kit", 1], ["Reusable water bottle", 1], ["Glasses or contact lenses", 1]] },
  { id: "accessories", name: "Travel accessories", icon: "luggage", items: [["Day bag with zippers", 1], ["Luggage lock", 1], ["Notebook and pen", 1], ["Packing cubes", 1]] },
  { id: "safety", name: "Safety essentials", icon: "shield-check", items: [["Personal alarm or whistle", 1], ["Money belt or hidden pouch", 1], ["Rubber door wedge", 1], ["Small torch", 1]] },
];

export function starterPacking() {
  return PACKING_CATEGORIES.flatMap((c) => c.items.map(([title, qty], i) => ({ id: `p-${c.id}-${i}`, group: c.id, title, qty, done: false, custom: false })));
}

export const DOCUMENTS = [
  { id: "passport", name: "Passport", hint: "Valid long enough, with blank pages", guide: "check-passport-expiry" },
  { id: "visa", name: "Visa or entry permit", hint: "Including any transit visa", guide: "check-passport-expiry" },
  { id: "identification", name: "Other identification", hint: "Driving licence or national ID", guide: "copy-important-documents" },
  { id: "insurance", name: "Travel insurance", hint: "Policy and 24/7 assistance number saved", guide: "get-the-right-travel-insurance" },
  { id: "tickets", name: "Tickets", hint: "Flights, trains and buses, saved offline", guide: "download-offline-maps" },
  { id: "accommodation", name: "Accommodation confirmation", hint: "Address and phone saved offline", guide: "book-first-night" },
  { id: "copies", name: "Emergency document copies", hint: "Digital and paper, stored apart", guide: "document-everything" },
];

export const STATUS_LABELS = { todo: "Not started", progress: "In progress", ready: "Ready", na: "Not needed" };
