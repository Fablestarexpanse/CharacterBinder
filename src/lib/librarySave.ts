/**
 * The one rule both save paths follow: a changed version means "keep the old
 * one too".
 *
 * Saving without the existing id makes the library gain a second record instead
 * of overwriting the first, which is the only way a user can keep v1 of a card
 * around after editing it into v2. The character editor and the four data-card
 * editors both implement it, and they used to implement it separately — with
 * separate wording for the three outcomes.
 */

export interface SaveTarget {
  /** The record to overwrite, or undefined to create a new one. */
  existingId: string | undefined;
  versionChanged: boolean;
  /** What to tell the user once the save lands. */
  message: string;
}

export function resolveSaveTarget(
  libraryId: string | undefined,
  version: string,
  savedVersion: string
): SaveTarget {
  const versionChanged = !!libraryId && version.trim() !== savedVersion;
  return {
    existingId: versionChanged ? undefined : libraryId,
    versionChanged,
    message: versionChanged
      ? "Saved as new version!"
      : libraryId
        ? "Library updated!"
        : "Saved to library!",
  };
}
