export type LookupStatus = "ok" | "unavailable" | "error";

export interface LookupResult<T> {
  status: LookupStatus;
  data: T | null;
  source: string;
  checkedAt: string;
  error?: string;
}
