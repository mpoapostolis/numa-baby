// A loop with no seam: the last `fade` samples are blended into the first
// ones and then cut off, so playing past the end lands exactly where the
// source would have gone next.
//
// The first version blended the tail in but kept it, so every pass replayed
// it and stepped from the last sample back to an earlier one — on brown
// noise a click per pass. The blend is equal-power: a linear one sags about
// 3dB through its middle when the two halves are unrelated noise.
export function seamlessLoop(data, fade) {
  const length = data.length - fade;
  const out = data.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const t = (i / fade) * (Math.PI / 2);
    out[i] = data[i] * Math.sin(t) + data[length + i] * Math.cos(t);
  }
  return out;
}
