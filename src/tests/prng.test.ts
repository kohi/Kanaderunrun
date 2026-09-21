import { describe, it, expect } from 'vitest';
import { createPRNG, generatePhotoAnimations } from '../core/prng';

describe('PRNG (Mulberry32)', () => {
  it('should generate reproducible numbers for the same seed', () => {
    const rng1 = createPRNG(12345);
    const rng2 = createPRNG(12345);

    const values1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const values2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(values1).toEqual(values2);
  });

  it('should generate different numbers for different seeds', () => {
    const rng1 = createPRNG(11111);
    const rng2 = createPRNG(99999);

    expect(rng1()).not.toEqual(rng2());
  });

  it('should generate identical photo animations for same seed and photo count', () => {
    const anim1 = generatePhotoAnimations(10, 42);
    const anim2 = generatePhotoAnimations(10, 42);

    expect(anim1).toEqual(anim2);
    expect(anim1).toHaveLength(10);
  });

  it('should generate different photo animations for different seeds', () => {
    const anim1 = generatePhotoAnimations(5, 100);
    const anim2 = generatePhotoAnimations(5, 200);

    expect(anim1).not.toEqual(anim2);
  });
});
