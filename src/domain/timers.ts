// Which kinds of entry run as a timer: started with one tap, open until a
// second one stops them. The list was written out by hand in six places;
// the next "can we time this too?" is now a one-line decision, made here.

import type { ActivityType } from "./types";

/** Numalog times only what nothing else in the room is timing: a sleeping
    baby, a breast, a burp, tummy time. A pump has its own display, so a
    pump is logged when it ends and is never open — leave it out of here. */
export const TIMED_TYPES: ReadonlySet<ActivityType> = new Set(["nursing", "sleep", "burp", "tummy"]);

export const isTimedType = (type: ActivityType) => TIMED_TYPES.has(type);
