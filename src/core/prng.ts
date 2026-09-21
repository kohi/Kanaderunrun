import type { PanDirection, PhotoAnimationConfig, ZoomDirection } from '../types/project';

/**
 * Mulberry32 is a simple and fast 32-bit PRNG with high quality and determinism.
 */
export function createPRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAN_DIRECTIONS: PanDirection[] = [
  'left',
  'right',
  'up',
  'down',
  'up-left',
  'up-right',
  'down-left',
  'down-right',
];

const ZOOM_DIRECTIONS: ZoomDirection[] = ['in', 'out'];

/**
 * Deterministically generates Ken Burns animation parameters for each photo in the project.
 * Uses the project's seed so preview and export will render with 100% identical animation parameters.
 */
export function generatePhotoAnimations(photoCount: number, seed: number): PhotoAnimationConfig[] {
  const rng = createPRNG(seed);
  const configs: PhotoAnimationConfig[] = [];

  for (let i = 0; i < photoCount; i++) {
    // Alternate zoom or pick randomly
    const zoomIdx = Math.floor(rng() * ZOOM_DIRECTIONS.length);
    const panIdx = Math.floor(rng() * PAN_DIRECTIONS.length);
    // Pan intensity between 0.35 and 0.85
    const panIntensity = 0.35 + rng() * 0.5;

    configs.push({
      zoomDirection: ZOOM_DIRECTIONS[zoomIdx],
      panDirection: PAN_DIRECTIONS[panIdx],
      panIntensity,
    });
  }

  return configs;
}
