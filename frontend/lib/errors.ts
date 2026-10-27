import { ApiError } from "./api";

/** A message that is safe to show to the person using the app. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
