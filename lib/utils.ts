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
