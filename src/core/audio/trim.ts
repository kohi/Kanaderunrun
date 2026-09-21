/** Clamp both endpoints to the actual decoded file, including sub-second clips. */
export function clampAudioTrim(duration: number, start: number, end: number) {
  const length = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const minimum = Math.min(1, length);
  const trimStart = Math.max(0, Math.min(Number.isFinite(start) ? start : 0, length - minimum));
  const trimEnd = Math.max(trimStart + minimum, Math.min(Number.isFinite(end) ? end : length, length));
  return { trimStart, trimEnd };
}
