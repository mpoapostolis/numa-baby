import { BabyFace } from "./illustrations";
import { usePhoto } from "../hooks/usePhoto";

/**
 * The baby's picture where the drawn face used to be — the header, the
 * sidebar — once a parent has chosen one in the profile. While the photo is
 * on its way the circle stays empty for that moment, rather than flashing
 * the drawing and swapping it out on every launch; the drawing is for "no
 * photo", and for a photo that cannot be had.
 */
export function BabyAvatar({ photo, size }: { photo: string | undefined; size?: number }) {
  const url = usePhoto(photo || undefined);
  if (url) return <img src={url} alt="" decoding="async" />;
  if (url === undefined && photo) return null;
  return <BabyFace size={size} />;
}
