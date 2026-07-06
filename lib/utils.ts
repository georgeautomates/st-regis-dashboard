import type { Job } from "@/lib/db";

const DS_SMITH_KEYWORDS = ["ds smith", "kemsley", "sittingbourne"];

export function hasLocationFlag(job: Job): boolean {
  const isReels = job.client_name.toLowerCase().includes("reels");
  const isFibre = job.client_name.toLowerCase().includes("fibre");
  if (isReels) {
    const coll = job.collection_point.toLowerCase();
    return !DS_SMITH_KEYWORDS.some(kw => coll.includes(kw));
  }
  if (isFibre) {
    const del = job.delivery_point.toLowerCase();
    return !DS_SMITH_KEYWORDS.some(kw => del.includes(kw));
  }
  return false;
}

/**
 * Groups a raw client_name into the dashboard's top-level client badge.
 * St Regis Fibre/Reels collapse into one "St Regis" group (the existing
 * Fibre/Reels sub-badge already distinguishes them); other onboarded
 * clients get their own group, keyed off their display name.
 */
export function clientGroup(clientName: string): string {
  const n = clientName.toLowerCase();
  if (n.includes("st regis")) return "St Regis";
  if (n.includes("aim") || n.includes("sig trading")) return "AIM";
  if (n.includes("cct worldwide")) return "CCT Worldwide";
  return clientName || "Unknown";
}
