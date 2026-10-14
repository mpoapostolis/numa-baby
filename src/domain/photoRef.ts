// A reference to a baby photo: the id it is kept under on the phone
// (lib/photos.ts) and, for a family that shares its log, in the private
// bucket (worker/photos.ts). The same shape the Worker accepts, so a
// reference that arrives over sync can never name anything else.

export const PHOTO_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * A photo reference from storage or another phone. "" is a deliberate "no
 * photo" and travels as one; undefined — absent, or not a photo id — is
 * "this copy has nothing to say", which a merge must not read as a removal.
 */
export function sanitizePhotoRef(value: unknown): string | undefined {
  if (value === "") return "";
  return typeof value === "string" && PHOTO_ID.test(value) ? value : undefined;
}

/** Where lib/photos.ts queues uploads and removals that failed. Kept here, on
    the boot path, so sync can see an empty queue without loading the photo
    code at all. */
export const PHOTO_QUEUE_KEY = "numalog-photo-queue-v1";

export function hasQueuedPhotos(): boolean {
  try {
    return Boolean(window.localStorage.getItem(PHOTO_QUEUE_KEY));
  } catch {
    return false;
  }
}
