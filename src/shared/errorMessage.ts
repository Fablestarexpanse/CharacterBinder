/**
 * The message from a caught value, which is `unknown` and need not be an Error.
 *
 * Catch blocks were split between `(err as Error).message` — a lie whenever
 * something throws a string, and `undefined` in the UI when it does — and a
 * longhand instanceof ternary written out at each site. One helper, used
 * everywhere, so neither idiom has to be chosen again.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err) return err;
  return String(err ?? "Unknown error");
}
