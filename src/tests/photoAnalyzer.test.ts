import { describe, it, expect } from 'vitest';
import {
  extractVisualMetrics,
  calculateSongFlowDurations,
  calculateSongFlowTransitions,
  orderPhotosBySongFlow,
  shufflePhotos,
  sortPhotosByName,
} from '../core/utils/photoAnalyzer';
import type { CoverSettings, PhotoItem, SongData } from '../types/project';

describe('photoAnalyzer & smart photo ordering', () => {
  const createMockPhoto = (
    id: string,
    name: string,
    brightness: number,
    saturation: number
  ): PhotoItem => {
    return {
      id,
      file: new File([], name),
      name,
      originalWidth: 1920,
      originalHeight: 1080,
      previewUrl: 'blob:test',
      bitmap: {} as ImageBitmap,
      visualMetrics: {
        brightness,
        saturation,
        warmth: 0.5,
        contrast: 0.5,
        energyScore: saturation * 0.5 + brightness * 0.5,
      },
    };
  };

  const mockSong: SongData = {
    file: new File([], 'song.mp3'),
    name: 'song.mp3',
    duration: 30,
    audioBuffer: {} as AudioBuffer,
    bpm: 120,
    firstBeatOffset: 0.5,
    beats: [0.5, 1.0, 1.5, 2.0],
    rms: 0.6,
    energyCurve: [
      { time: 0, energy: 0.2 },
      { time: 10, energy: 0.4 },
      { time: 15, energy: 0.95 }, // Climax
      { time: 20, energy: 0.8 },
      { time: 30, energy: 0.1 },
    ],
    trimStart: 0,
    trimEnd: 30,
    detectedPreset: 'standard',
  };

  it('safely extracts fallback metrics when canvas context is unavailable', () => {
    const metrics = extractVisualMetrics({} as ImageBitmap);
    expect(metrics.brightness).toBe(0.5);
    expect(metrics.energyScore).toBe(0.5);
  });

  it('calculates song flow durations whose sum matches total duration', () => {
    const durations = calculateSongFlowDurations(6, mockSong);
    expect(durations).toHaveLength(6);

    const sum = Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10;
    expect(sum).toBe(30);

    // Chorus (middle) durations should be shorter than intro/outro
    expect(durations[2]).toBeLessThan(durations[0]);
    expect(durations[3]).toBeLessThan(durations[5]);
  });

  it('calculates song flow durations correctly when cover settings are enabled', () => {
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
        duration: 3.0,
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

    // Total 30s - 6s (covers) = 24s for 4 photos
    const durations = calculateSongFlowDurations(4, mockSong, coverSettings);
    expect(durations).toHaveLength(4);

    const sum = Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10;
    expect(sum).toBe(24);
  });

  it('calculates energy-adaptive transitions matching song narrative', () => {
    const transitions = calculateSongFlowTransitions(6, mockSong);
    expect(transitions).toHaveLength(6);

    // Intro transition should be light-leak or crossfade
    expect(['light-leak', 'crossfade']).toContain(transitions[0]);

    // Climax (middle) transitions should include flash or zoom
    expect(['flash', 'zoom', 'slide']).toContain(transitions[3]);
  });

  it('shuffles photos randomly', () => {
    const photos = [
      createMockPhoto('1', 'photo1.jpg', 0.2, 0.1),
      createMockPhoto('2', 'photo2.jpg', 0.5, 0.5),
      createMockPhoto('3', 'photo3.jpg', 0.9, 0.9),
      createMockPhoto('4', 'photo4.jpg', 0.7, 0.3),
      createMockPhoto('5', 'photo5.jpg', 0.4, 0.8),
    ];

    const shuffled = shufflePhotos(photos);
    expect(shuffled.length).toBe(photos.length);
    expect(shuffled.map((p) => p.id).sort()).toEqual(photos.map((p) => p.id).sort());
  });

  it('sorts photos naturally by filename', () => {
    const photos = [
      createMockPhoto('3', 'IMG_10.jpg', 0.5, 0.5),
      createMockPhoto('1', 'IMG_2.jpg', 0.5, 0.5),
      createMockPhoto('2', 'IMG_1.jpg', 0.5, 0.5),
    ];

    const sorted = sortPhotosByName(photos);
    expect(sorted.map((p) => p.name)).toEqual(['IMG_1.jpg', 'IMG_2.jpg', 'IMG_10.jpg']);
  });

  it('orders photos and assigns dynamic durations & transitions matching energy peaks', () => {
    const photos = [
      createMockPhoto('calm1', 'calm1.jpg', 0.2, 0.1),
      createMockPhoto('calm2', 'calm2.jpg', 0.3, 0.2),
      createMockPhoto('peak', 'climax.jpg', 0.9, 0.9),
      createMockPhoto('mid', 'mid.jpg', 0.5, 0.5),
    ];

    const reordered = orderPhotosBySongFlow(photos, mockSong, true, true);
    expect(reordered.length).toBe(photos.length);

    // Peak photo should be placed around the middle (where song climax occurs)
    const peakIndex = reordered.findIndex((p) => p.id === 'peak');
    expect(peakIndex).toBeGreaterThanOrEqual(1);
    expect(peakIndex).toBeLessThanOrEqual(2);

    // Every photo should have a lockedDuration and transitionType assigned
    reordered.forEach((p) => {
      expect(p.lockedDuration).toBeDefined();
      expect(p.lockedDuration).toBeGreaterThanOrEqual(1.5);
      expect(p.transitionType).toBeDefined();
    });

    const sum = Math.round(reordered.reduce((a, b) => a + (b.lockedDuration || 0), 0) * 10) / 10;
    expect(sum).toBe(30);
  });

  it('orders photos based on pure raw audio peaks in audio-peak pattern', () => {
    // Song with early peak at time = 5s (slot 0 or 1)
    const earlyPeakSong: SongData = {
      ...mockSong,
      energyCurve: [
        { time: 5, energy: 0.99 }, // Early peak
        { time: 15, energy: 0.2 },
        { time: 25, energy: 0.1 },
      ],
    };

    const photos = [
      createMockPhoto('calm', 'calm.jpg', 0.2, 0.1),
      createMockPhoto('peak', 'peak.jpg', 0.95, 0.95),
      createMockPhoto('mid', 'mid.jpg', 0.5, 0.5),
    ];

    const reordered = orderPhotosBySongFlow(photos, earlyPeakSong, true, true, undefined, 'audio-peak');
    // Peak photo must be placed at the early peak slot (slot 0)
    expect(reordered[0].id).toBe('peak');
  });

  it('orders photos in smooth color/mood gradient progression in color-flow pattern', () => {
    const photos = [
      createMockPhoto('warm_bright', 'warm.jpg', 0.9, 0.9),
      createMockPhoto('cool_dark', 'cool.jpg', 0.2, 0.1),
      createMockPhoto('mid_tone', 'mid.jpg', 0.5, 0.5),
    ];

    const reordered = orderPhotosBySongFlow(photos, mockSong, true, true, undefined, 'color-flow');
    expect(reordered[0].id).toBe('cool_dark');
    expect(reordered[2].id).toBe('warm_bright');
  });

  it('orders photos towards a rising climax in rising-climax pattern', () => {
    const photos = [
      createMockPhoto('peak', 'peak.jpg', 0.95, 0.95),
      createMockPhoto('calm', 'calm.jpg', 0.2, 0.1),
      createMockPhoto('mid', 'mid.jpg', 0.5, 0.5),
    ];

    const reordered = orderPhotosBySongFlow(photos, mockSong, true, true, undefined, 'rising-climax');
    // Most vibrant photo should be placed at the end (slot 2)
    expect(reordered[2].id).toBe('peak');
    expect(reordered[0].id).toBe('calm');
  });
});
