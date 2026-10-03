// Synthetic reference catalog parsed from the unmodified build-pack CSVs.
import destinationsCsv from "@/data/destinations.csv?raw";
import originsCsv from "@/data/origins.csv?raw";
import flightsCsv from "@/data/flights.csv?raw";
import hotelsCsv from "@/data/hotels.csv?raw";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCsv(text: string): any[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((v) => v !== "")) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const bool = (v: string) => v === "True" || v === "true";
const int = (v: string) => Number.parseInt(v, 10);

export type Destination = {
  destination_id: string; city: string; meal_inr_per_person_day: number;
  transfer_inr_per_group: number; valid_from: string; valid_to: string;
  is_synthetic: boolean; dataset_version: string; description: string;
};
export type Origin = { origin_id: string; city: string; is_synthetic: boolean };
export type Flight = {
  flight_id: string; origin_id: string; destination_id: string; label: string;
  roundtrip_inr_per_person: number; stops_each_way: number; duration_minutes_each_way: number;
  baggage_kg: number; cancellation_inr_per_person: number; taxes_included: boolean;
  valid_from: string; valid_to: string; is_synthetic: boolean; dataset_version: string;
};
export type Hotel = {
  hotel_id: string; destination_id: string; label: string; nightly_inr_per_room: number;
  max_guests_per_room: number; max_rooms: number; quiet: boolean; step_free: boolean;
  diet_tags: string[]; refundable: boolean; cancellation_terms: string; taxes_included: boolean;
  valid_from: string; valid_to: string; is_synthetic: boolean; dataset_version: string;
};

export type Catalog = {
  destinations: Destination[]; origins: Origin[]; flights: Flight[]; hotels: Hotel[];
  raw: { destinations: Record<string, string>[]; origins: Record<string, string>[]; flights: Record<string, string>[]; hotels: Record<string, string>[] };
};

let cached: Catalog | null = null;

export function getCatalog(): Catalog {
  if (cached) return cached;
  const rd = parseCsv(destinationsCsv), ro = parseCsv(originsCsv), rf = parseCsv(flightsCsv), rh = parseCsv(hotelsCsv);
  cached = {
    raw: { destinations: rd, origins: ro, flights: rf, hotels: rh },
    destinations: rd.map((r) => ({
      destination_id: r.destination_id, city: r.city, meal_inr_per_person_day: int(r.meal_inr_per_person_day),
      transfer_inr_per_group: int(r.transfer_inr_per_group), valid_from: r.valid_from, valid_to: r.valid_to,
      is_synthetic: bool(r.is_synthetic), dataset_version: r.dataset_version, description: r.description,
    })),
    origins: ro.map((r) => ({ origin_id: r.origin_id, city: r.city, is_synthetic: bool(r.is_synthetic) })),
    flights: rf.map((r) => ({
      flight_id: r.flight_id, origin_id: r.origin_id, destination_id: r.destination_id, label: r.label,
      roundtrip_inr_per_person: int(r.roundtrip_inr_per_person), stops_each_way: int(r.stops_each_way),
      duration_minutes_each_way: int(r.duration_minutes_each_way), baggage_kg: int(r.baggage_kg),
      cancellation_inr_per_person: int(r.cancellation_inr_per_person), taxes_included: bool(r.taxes_included),
      valid_from: r.valid_from, valid_to: r.valid_to, is_synthetic: bool(r.is_synthetic), dataset_version: r.dataset_version,
    })),
    hotels: rh.map((r) => ({
      hotel_id: r.hotel_id, destination_id: r.destination_id, label: r.label,
      nightly_inr_per_room: int(r.nightly_inr_per_room), max_guests_per_room: int(r.max_guests_per_room),
      max_rooms: int(r.max_rooms), quiet: bool(r.quiet), step_free: bool(r.step_free),
      diet_tags: r.diet_tags ? String(r.diet_tags).split(";").map((s: string) => s.trim().toLowerCase()).filter(Boolean) : [],
      refundable: bool(r.refundable), cancellation_terms: r.cancellation_terms, taxes_included: bool(r.taxes_included),
      valid_from: r.valid_from, valid_to: r.valid_to, is_synthetic: bool(r.is_synthetic), dataset_version: r.dataset_version,
    })),
  };
  return cached;
}

export const DATASET_VERSION = "1.0";
