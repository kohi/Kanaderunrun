import { clampAudioTrim } from '../core/audio/trim';
import { describe, it, expect, vi } from 'vitest';
import {
  getAudioFadeGain,
  getVideoFadeBlackAlpha,
  getVideoFadeInBlackAlpha,
} from '../core/audio/fade';
import { determineVibePreset } from '../core/audio/analyzer';
import { AudioPreviewPlayer } from '../core/audio/player';

describe('Audio & Video Fade Curves', () => {
  const duration = 20.0; // 20s track

  it('should apply head fade-in over 0.5s by default', () => {
    expect(getAudioFadeGain(0, duration)).toBe(0);
    expect(getAudioFadeGain(0.25, duration)).toBeCloseTo(0.5, 2);
    expect(getAudioFadeGain(0.5, duration)).toBe(1.0);
    expect(getAudioFadeGain(5.0, duration)).toBe(1.0);
  });

  it('should allow disabling head fade-in (headFade = 0)', () => {
    expect(getAudioFadeGain(0, duration, 0, 2.0)).toBe(1.0);
    expect(getVideoFadeInBlackAlpha(0, 0)).toBe(0);
  });

  it('should allow custom head fade-in duration (e.g. 1.5s)', () => {
    expect(getAudioFadeGain(0.75, duration, 1.5, 2.0)).toBeCloseTo(0.5, 2);
    expect(getVideoFadeInBlackAlpha(0, 1.5)).toBe(1.0);
    expect(getVideoFadeInBlackAlpha(1.5, 1.5)).toBe(0);
  });

  it('should apply tail fade-out over 2.0s by default', () => {
    expect(getAudioFadeGain(18.0, duration)).toBe(1.0); // 20 - 2.0 = 18.0s start
    expect(getAudioFadeGain(19.0, duration)).toBeCloseTo(0.5, 2);
    expect(getAudioFadeGain(20.0, duration)).toBe(0.0);
  });

  it('should allow disabling tail fade-out (tailFade = 0)', () => {
    expect(getAudioFadeGain(19.5, duration, 0.5, 0)).toBe(1.0);
    expect(getVideoFadeBlackAlpha(19.5, duration, 0)).toBe(0);
  });

  it('should allow custom tail fade-out duration (e.g. 4.0s)', () => {
    expect(getAudioFadeGain(16.0, duration, 0.5, 4.0)).toBe(1.0);
    expect(getAudioFadeGain(18.0, duration, 0.5, 4.0)).toBeCloseTo(0.5, 2);
    expect(getVideoFadeBlackAlpha(18.0, duration, 4.0)).toBeGreaterThan(0);
  });
});

describe('Vibe Preset Detection', () => {
  it('should detect slow vibe for low BPM or low RMS', () => {
    expect(determineVibePreset(80, 0.15)).toBe('slow');
    expect(determineVibePreset(110, 0.08)).toBe('slow');
  });

  it('should detect up vibe for high BPM and high RMS', () => {
    expect(determineVibePreset(140, 0.20)).toBe('up');
  });

  it('should detect standard vibe for medium values', () => {
    expect(determineVibePreset(115, 0.14)).toBe('standard');
  });
});

describe('AudioPreviewPlayer seeking and timing', () => {
  const mockBuffer = {
    duration: 60,
    numberOfChannels: 2,
    sampleRate: 44100,
  } as AudioBuffer;

  it('calculates duration based on trimStart and trimEnd correctly', () => {
    const player = new AudioPreviewPlayer();
    player.setAudioBuffer(mockBuffer, 10, 45);

    expect(player.duration).toBe(35);
  });

  it('updates currentTime on seek while paused', () => {
    const onTimeUpdate = vi.fn();
    const player = new AudioPreviewPlayer(onTimeUpdate);
    player.setAudioBuffer(mockBuffer, 5, 25);

    player.seek(12);
    expect(player.currentTime).toBe(12);
    expect(onTimeUpdate).toHaveBeenCalledWith(12);

    // Clamps to duration
    player.seek(50);
    expect(player.currentTime).toBe(20); // 25 - 5 = 20s
  });
});

describe('audio trim boundaries', () => {
  it('uses the selected span rather than the original full duration', () => {
    expect(clampAudioTrim(180, 30, 90)).toEqual({ trimStart:30, trimEnd:90 });
  });
  it('never extends a sub-second source to one second', () => {
    expect(clampAudioTrim(0.4, 0, 0.4)).toEqual({ trimStart:0, trimEnd:0.4 });
  });
  it('clamps crossed and out-of-range endpoints', () => {
    expect(clampAudioTrim(5, 10, 2)).toEqual({ trimStart:4, trimEnd:5 });
    expect(clampAudioTrim(5, -2, 20)).toEqual({ trimStart:0, trimEnd:5 });
  });
});
