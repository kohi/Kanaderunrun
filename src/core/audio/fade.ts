export const DEFAULT_HEAD_FADE_DURATION = 0.5; // 0.5s audio fade-in
export const DEFAULT_TAIL_FADE_DURATION = 2.0; // 2.0s audio & video fade-out

/**
 * Calculates audio volume gain factor (0.0 to 1.0) at time t for a track of given duration.
 * Includes optional fade-in and fade-out.
 */
export function getAudioFadeGain(
  t: number,
  totalDuration: number,
  headFade: number = DEFAULT_HEAD_FADE_DURATION,
  tailFade: number = DEFAULT_TAIL_FADE_DURATION
): number {
  if (t < 0 || t > totalDuration) return 0;

  let gain = 1.0;

  // Head fade-in
  if (headFade > 0 && t < headFade) {
    gain = Math.min(gain, t / headFade);
  }

  // Tail fade-out
  const tailStart = Math.max(0, totalDuration - tailFade);
  if (tailFade > 0 && t > tailStart) {
    const remaining = totalDuration - t;
    gain = Math.min(gain, Math.max(0, remaining / tailFade));
  }

  // Clamp 0 to 1
  return Math.max(0, Math.min(1, gain));
}

/**
 * Calculates video black overlay opacity (0.0 to 1.0) at start of video (fade in from black).
 */
export function getVideoFadeInBlackAlpha(
  t: number,
  headFade: number = DEFAULT_HEAD_FADE_DURATION
): number {
  if (t < 0) return 1.0;
  if (headFade <= 0 || t >= headFade) return 0;

  const progress = t / headFade;
  const remaining = 1.0 - progress;
  return Math.max(0, Math.min(1, remaining * remaining));
}

/**
 * Calculates video black overlay opacity (0.0 to 1.0) at end of video (fade out to black).
 */
export function getVideoFadeBlackAlpha(
  t: number,
  totalDuration: number,
  tailFade: number = DEFAULT_TAIL_FADE_DURATION
): number {
  if (t < 0) return 0;
  if (t >= totalDuration) return 1.0;
  if (tailFade <= 0) return 0;

  const tailStart = Math.max(0, totalDuration - tailFade);
  if (t <= tailStart) {
    return 0;
  }

  const progress = (t - tailStart) / tailFade;
  return Math.max(0, Math.min(1, progress * progress));
}
