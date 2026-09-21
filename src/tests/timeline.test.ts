import { describe, it, expect } from 'vitest';
import { generateTimeline } from '../core/timeline/generator';
import type { CoverSettings, PhotoItem, SongData } from '../types/project';

describe('Timeline Generator', () => {
  const createMockSong = (duration: number, bpm: number = 120): SongData => {
    const beatInterval = 60 / bpm;
    const beats: number[] = [];
    for (let t = 0; t < duration; t += beatInterval) {
      beats.push(t);
    }

    return {
      file: new File([], 'mock.mp3'),
      name: 'mock',
      duration,
      audioBuffer: {} as AudioBuffer,
      bpm,
      firstBeatOffset: 0,
      beats,
      rms: 0.20,
      energyCurve: [{ time: 5, energy: 0.25 }],
      trimStart: 0,
      trimEnd: duration,
      detectedPreset: 'standard',
    };
  };

  const createMockPhotos = (count: number, lockedMap?: Record<number, number>): PhotoItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `p_${i}`,
      file: new File([], `photo_${i}.jpg`),
      name: `photo_${i}.jpg`,
      originalWidth: 1920,
      originalHeight: 1080,
      previewUrl: '',
      bitmap: {} as ImageBitmap,
      lockedDuration: lockedMap && lockedMap[i] !== undefined ? lockedMap[i] : undefined,
    }));
  };

  it('should generate valid timeline segments matching total duration', () => {
    const song = createMockSong(30, 120); // 30s song
    const photos = createMockPhotos(6); // 6 photos -> avg 5s each
    const timeline = generateTimeline(song, photos, 'standard', 1234, 'dynamic');

    expect(timeline.totalDuration).toBeCloseTo(30, 1);
    expect(timeline.segments).toHaveLength(6);
    expect(timeline.isExceeded).toBe(false);

    // Verify first and last cutpoints
    expect(timeline.segments[0].startTime).toBe(0);
    expect(timeline.segments[5].endTime).toBeCloseTo(30, 1);

    // Verify strictly monotonic time progression
    for (let i = 0; i < timeline.segments.length - 1; i++) {
      expect(timeline.segments[i].endTime).toBeCloseTo(timeline.segments[i + 1].startTime, 4);
      expect(timeline.segments[i].duration).toBeGreaterThan(0.5);
    }
  });

  it('should adjust unlocked photo durations when specific photos are locked', () => {
    const song = createMockSong(30, 120); // 30s song
    // Lock photo #0 to 10.0s. Remaining 20.0s for 4 photos -> ~5.0s each
    const photos = createMockPhotos(5, { 0: 10.0 });
    const timeline = generateTimeline(song, photos, 'standard', 1234);

    expect(timeline.lockedCount).toBe(1);
    expect(timeline.lockedTotalTime).toBe(10.0);
    expect(timeline.unlockedCount).toBe(4);
    expect(timeline.unlockedAverageTime).toBeCloseTo(5.0, 1);
    expect(timeline.segments[0].duration).toBeCloseTo(10.0, 1);
    expect(timeline.messages.some((m) => m.type === 'info')).toBe(true);
  });

  it('should correctly position title cover and ending cover when enabled', () => {
    const song = createMockSong(30, 120); // 30s song
    const photos = createMockPhotos(4); // 4 photos
    const coverSettings: CoverSettings = {
      titleCover: {
        enabled: true,
        duration: 3.0,
        photo: {
          id: 'c_title',
          file: new File([], 'title.jpg'),
          name: 'title.jpg',
          originalWidth: 1920,
          originalHeight: 1080,
          previewUrl: '',
          bitmap: {} as ImageBitmap,
        },
      },
      endingCover: {
        enabled: true,
        duration: 4.0,
        photo: {
          id: 'c_end',
          file: new File([], 'end.jpg'),
          name: 'end.jpg',
          originalWidth: 1920,
          originalHeight: 1080,
          previewUrl: '',
          bitmap: {} as ImageBitmap,
        },
      },
    };

    const timeline = generateTimeline(
      song,
      photos,
      'standard',
      1234,
      'dynamic',
      true,
      0.5,
      true,
      2.0,
      coverSettings
    );

    // Total segments: 1 (title) + 4 (photos) + 1 (ending) = 6
    expect(timeline.segments).toHaveLength(6);

    // Title cover check
    const titleSeg = timeline.segments[0];
    expect(titleSeg.isTitleCover).toBe(true);
    expect(titleSeg.startTime).toBe(0);
    expect(titleSeg.endTime).toBeCloseTo(3.0, 1);
    expect(titleSeg.duration).toBeCloseTo(3.0, 1);

    // Ending cover check
    const endSeg = timeline.segments[timeline.segments.length - 1];
    expect(endSeg.isEndingCover).toBe(true);
    expect(endSeg.startTime).toBeCloseTo(26.0, 1);
    expect(endSeg.endTime).toBeCloseTo(30.0, 1);
    expect(endSeg.duration).toBeCloseTo(4.0, 1);

    // Middle photos check (allocated across 3.0s to 26.0s = 23s / 4 photos ~ 5.75s)
    const middlePhotos = timeline.segments.slice(1, 5);
    expect(middlePhotos[0].startTime).toBeCloseTo(3.0, 1);
    expect(middlePhotos[3].endTime).toBeCloseTo(26.0, 1);
  });

  it('should produce a warning message when locking photos causes remaining photos to have < 1.5s', () => {
    const song = createMockSong(20, 120); // 20s song
    // Lock photo #0 to 16.0s. Remaining 4.0s for 4 photos -> 1.0s each < 1.5s
    const photos = createMockPhotos(5, { 0: 16.0 });
    const timeline = generateTimeline(song, photos, 'standard', 1234);

    expect(timeline.isExceeded).toBe(true);
    expect(timeline.messages.some((m) => m.type === 'warning' || m.type === 'error')).toBe(true);
  });

  it('should produce an error message when locked durations exceed total song duration', () => {
    const song = createMockSong(20, 120); // 20s song
    // Lock photo #0 to 15.0s, photo #1 to 10.0s = 25s > 20s
    const photos = createMockPhotos(3, { 0: 15.0, 1: 10.0 });
    const timeline = generateTimeline(song, photos, 'standard', 1234);

    expect(timeline.hasInsufficientTime).toBe(true);
    expect(timeline.messages.some((m) => m.type === 'error')).toBe(true);
  });

  it('should assign punchy transition types in dynamic mode', () => {
    const song = createMockSong(30, 140);
    const photos = createMockPhotos(6);

    const timeline = generateTimeline(song, photos, 'up', 42, 'dynamic');
    const transitionTypes = timeline.segments.map((s) => s.transitionType);

    expect(transitionTypes.length).toBe(6);
    const hasPunchy = transitionTypes.some((t) => ['flash', 'zoom', 'slide'].includes(t));
    expect(hasPunchy).toBe(true);
  });

  it('should assign explicit transition style when selected', () => {
    const song = createMockSong(30, 120);
    const photos = createMockPhotos(4);

    const flashTimeline = generateTimeline(song, photos, 'standard', 99, 'flash');
    expect(flashTimeline.segments.every((s) => s.transitionType === 'flash')).toBe(true);

    const zoomTimeline = generateTimeline(song, photos, 'standard', 99, 'zoom');
    expect(zoomTimeline.segments.every((s) => s.transitionType === 'zoom')).toBe(true);

    const crossfadeTimeline = generateTimeline(song, photos, 'standard', 99, 'crossfade');
    expect(crossfadeTimeline.segments.every((s) => s.transitionType === 'crossfade')).toBe(true);
  });
});
