import type {
  CoverSettings,
  PhotoItem,
  PhotoVisualMetrics,
  TimingSong,
  SongFlowPattern,
  TransitionType,
} from '../../types/project';

export interface SongFlowPatternOption {
  id: SongFlowPattern;
  name: string;
  shortName: string;
  badge: string;
  icon: string;
  description: string;
}

export const SONG_FLOW_PATTERNS: SongFlowPatternOption[] = [
  {
    id: 'narrative',
    name: 'パターンA: 王道ストーリー（サビ強調）',
    shortName: '王道ストーリー',
    badge: 'おすすめ',
    icon: '✨',
    description: 'イントロ（穏やか）➔ サビ（鮮やか・高エネルギー）➔ 余韻（穏やか）の自然な展開。',
  },
  {
    id: 'audio-peak',
    name: 'パターンB: 楽曲ピーク直結（ダイナミック）',
    shortName: '楽曲ピーク直結',
    badge: '波形一致',
    icon: '🌊',
    description: '楽曲の実際の音量・エネルギー波形のピーク位置に鮮やかな写真を完全連動。',
  },
  {
    id: 'color-flow',
    name: 'パターンC: 色彩グラデーション（カラーフロー）',
    shortName: '色彩グラデーション',
    badge: '美しい移り変わり',
    icon: '🎨',
    description: '写真の色温度・明るさ・トーンが時間とともに美しく滑らかに移り変わる芸術的展開。',
  },
  {
    id: 'rising-climax',
    name: 'パターンD: 後半クライマックス（ドラマチック）',
    shortName: '後半クライマックス',
    badge: '終盤盛り上がり',
    icon: '🚀',
    description: '冒頭から終盤・ラストに向けて写真の鮮やかさや盛り上がりが徐々に高まる構成。',
  },
];

/**
 * Computes visual properties (brightness, saturation, warmth, contrast, energy score)
 * by downsampling the image onto a lightweight 32x32 offscreen canvas.
 */
export function extractVisualMetrics(
  source: ImageBitmap | HTMLCanvasElement
): PhotoVisualMetrics {
  const defaultMetrics: PhotoVisualMetrics = {
    brightness: 0.5,
    saturation: 0.5,
    warmth: 0.5,
    contrast: 0.5,
    energyScore: 0.5,
  };

  const sampleSize = 32;
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(sampleSize, sampleSize);
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
  }

  if (!canvas) {
    return defaultMetrics;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

  if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.getImageData !== 'function') {
    return defaultMetrics;
  }

  try {
    ctx.drawImage(source as CanvasImageSource, 0, 0, sampleSize, sampleSize);
    const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const totalPixels = sampleSize * sampleSize;

    let totalLuminance = 0;
    let totalSaturation = 0;
    let totalWarmth = 0;
    const luminances: number[] = [];

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i] / 255;
      const g = imgData[i + 1] / 255;
      const b = imgData[i + 2] / 255;

      // Standard Perceived Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luminances.push(lum);
      totalLuminance += lum;

      // Saturation (max - min) / max
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      totalSaturation += sat;

      // Warmth: Red/Amber bias vs Blue bias
      const warm = Math.max(0, Math.min(1, (r - b + 1) / 2));
      totalWarmth += warm;
    }

    const avgBrightness = totalLuminance / totalPixels;
    const avgSaturation = totalSaturation / totalPixels;
    const avgWarmth = totalWarmth / totalPixels;

    // Standard deviation for contrast
    let variance = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = luminances[i] - avgBrightness;
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / totalPixels);
    const contrast = Math.min(1, stdDev * 3);

    // Composite visual energy score (high saturation + contrast + clarity = high energy)
    const energyScore = Math.max(
      0,
      Math.min(1, avgSaturation * 0.45 + contrast * 0.35 + avgBrightness * 0.2)
    );

    return {
      brightness: avgBrightness,
      saturation: avgSaturation,
      warmth: avgWarmth,
      contrast,
      energyScore,
    };
  } catch {
    return defaultMetrics;
  }
}

/**
 * Ensures visual metrics are calculated and cached on the photo items.
 */
export function ensurePhotoMetrics(photos: PhotoItem[]): PhotoItem[] {
  return photos.map((p) => {
    if (p.visualMetrics) return p;
    try {
      const metrics = extractVisualMetrics(p.bitmap as ImageBitmap | HTMLCanvasElement);
      return { ...p, visualMetrics: metrics };
    } catch {
      return {
        ...p,
        visualMetrics: {
          brightness: 0.5,
          saturation: 0.5,
          warmth: 0.5,
          contrast: 0.5,
          energyScore: 0.5,
        },
      };
    }
  });
}

/**
 * Calculates rhythm- and energy-aware display durations (in seconds) for each photo slot.
 * Takes into account optional opening title and ending outro covers.
 */
export function calculateSongFlowDurations(
  count: number,
  song: TimingSong,
  coverSettings?: CoverSettings
): number[] {
  if (count <= 0) return [];
  const trimStart = song.trimStart || 0;
  const trimEnd = song.trimEnd || song.duration;
  const totalDuration = Math.max(0.1, trimEnd - trimStart);

  const hasTitleCover = !!(coverSettings?.titleCover?.enabled && coverSettings.titleCover.photo);
  const titleDuration = hasTitleCover ? Math.max(1.0, coverSettings?.titleCover?.duration || 3.0) : 0;

  const hasEndingCover = !!(coverSettings?.endingCover?.enabled && coverSettings.endingCover.photo);
  const endingDuration = hasEndingCover ? Math.max(1.0, coverSettings?.endingCover?.duration || 3.5) : 0;

  const mainDuration = Math.max(0.1, totalDuration - (titleDuration + endingDuration));

  if (count === 1) return [Math.round(mainDuration * 10) / 10];
  if (count === 2) {
    const d1 = Math.round(mainDuration * 0.45 * 10) / 10;
    const d2 = Math.round((mainDuration - d1) * 10) / 10;
    return [d1, d2];
  }

  const baseDuration = mainDuration / count;
  const rawDurations: number[] = [];
  const windowStart = trimStart + titleDuration;

  // Calculate raw weights per slot
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const time = windowStart + (i + 0.5) * baseDuration;
    let localEnergy = song.rms;

    if (song.energyCurve && song.energyCurve.length > 0) {
      const pt = song.energyCurve.find((p) => Math.abs(p.time - time) < baseDuration);
      if (pt) localEnergy = pt.energy;
    }

    // Inverse weight: Higher energy -> shorter duration (quicker cuts)
    // Lower energy (intro/outro) -> longer duration (linger longer)
    let weight = 1.0;
    if (progress < 0.15) {
      weight = 1.25; // Intro scene
    } else if (progress > 0.40 && progress < 0.75) {
      weight = localEnergy > 0.15 ? 0.75 : 0.85; // Chorus / Peak
    } else if (progress > 0.88) {
      weight = 1.35; // Final outro lingering
    } else {
      weight = 0.95; // Mid verses
    }

    rawDurations.push(baseDuration * weight);
  }

  // Normalize so sum equals mainDuration
  const rawSum = rawDurations.reduce((a, b) => a + b, 0);
  const scale = mainDuration / rawSum;

  const minAllowed = Math.min(1.5, mainDuration / count);
  const roundedDurations = rawDurations.map((d) => {
    const scaled = d * scale;
    return Math.max(minAllowed, Math.round(scaled * 10) / 10);
  });

  // Adjust any small rounding difference on the longest / last slot
  const currentSum = roundedDurations.reduce((a, b) => a + b, 0);
  const diff = Math.round((mainDuration - currentSum) * 10) / 10;

  if (diff !== 0) {
    const targetIdx = roundedDurations.length - 1;
    roundedDurations[targetIdx] = Math.max(
      minAllowed,
      Math.round((roundedDurations[targetIdx] + diff) * 10) / 10
    );
  }

  return roundedDurations;
}

/**
 * Assigns tailored transition effects matching each section's musical energy.
 */
export function calculateSongFlowTransitions(
  count: number,
  song: TimingSong,
  coverSettings?: CoverSettings
): TransitionType[] {
  if (count <= 0) return [];
  const trimStart = song.trimStart || 0;
  const trimEnd = song.trimEnd || song.duration;
  const totalDuration = Math.max(0.1, trimEnd - trimStart);

  const hasTitleCover = !!(coverSettings?.titleCover?.enabled && coverSettings.titleCover.photo);
  const titleDuration = hasTitleCover ? Math.max(1.0, coverSettings?.titleCover?.duration || 3.0) : 0;

  const hasEndingCover = !!(coverSettings?.endingCover?.enabled && coverSettings.endingCover.photo);
  const endingDuration = hasEndingCover ? Math.max(1.0, coverSettings?.endingCover?.duration || 3.5) : 0;

  const mainDuration = Math.max(0.1, totalDuration - (titleDuration + endingDuration));
  const baseDuration = mainDuration / count;
  const windowStart = trimStart + titleDuration;

  const transitions: TransitionType[] = [];

  for (let i = 0; i < count; i++) {
    const progress = count > 1 ? i / (count - 1) : 0.5;
    const time = windowStart + (i + 0.5) * baseDuration;
    let localEnergy = song.rms;

    if (song.energyCurve && song.energyCurve.length > 0) {
      const pt = song.energyCurve.find((p) => Math.abs(p.time - time) < baseDuration);
      if (pt) localEnergy = pt.energy;
    }

    const isHighEnergy = localEnergy >= 0.16;

    if (progress < 0.20) {
      transitions.push(i % 2 === 0 ? 'light-leak' : 'crossfade');
    } else if (progress >= 0.40 && progress <= 0.78) {
      if (isHighEnergy) {
        transitions.push(i % 2 === 0 ? 'flash' : 'zoom');
      } else {
        transitions.push(i % 3 === 0 ? 'zoom' : i % 3 === 1 ? 'slide' : 'flash');
      }
    } else if (progress > 0.85) {
      transitions.push(i % 2 === 0 ? 'dip-black' : 'crossfade');
    } else {
      transitions.push(i % 3 === 0 ? 'slide' : i % 3 === 1 ? 'zoom' : 'light-leak');
    }
  }

  return transitions;
}

/**
 * Smartly arranges photo order to match the selected smart pattern (A, B, C, D),
 * taking into account opening/ending covers and song energy curves.
 */
export function orderPhotosBySongFlow(
  photos: PhotoItem[],
  song: TimingSong,
  applyDurations: boolean = true,
  applyTransitions: boolean = true,
  coverSettings?: CoverSettings,
  pattern: SongFlowPattern = 'narrative'
): PhotoItem[] {
  if (photos.length <= 1) return [...photos];

  const enrichedPhotos = ensurePhotoMetrics(photos);
  const N = enrichedPhotos.length;
  const trimStart = song.trimStart || 0;
  const trimEnd = song.trimEnd || song.duration;
  const totalDuration = Math.max(0.1, trimEnd - trimStart);

  const hasTitleCover = !!(coverSettings?.titleCover?.enabled && coverSettings.titleCover.photo);
  const titleDuration = hasTitleCover ? Math.max(1.0, coverSettings?.titleCover?.duration || 3.0) : 0;

  const hasEndingCover = !!(coverSettings?.endingCover?.enabled && coverSettings.endingCover.photo);
  const endingDuration = hasEndingCover ? Math.max(1.0, coverSettings?.endingCover?.duration || 3.5) : 0;

  const mainDuration = Math.max(0.1, totalDuration - (titleDuration + endingDuration));
  const segDuration = mainDuration / N;
  const windowStart = trimStart + titleDuration;

  // 1. Calculate dynamic durations & transitions
  const dynamicDurations = applyDurations
    ? calculateSongFlowDurations(N, song, coverSettings)
    : null;

  const dynamicTransitions = applyTransitions
    ? calculateSongFlowTransitions(N, song, coverSettings)
    : null;

  const result: PhotoItem[] = new Array(N);

  if (pattern === 'color-flow') {
    // Pattern C: Aesthetic Color & Mood Gradient Flow
    // Sort photos along color warmth, brightness & saturation progression
    const sortedByColor = [...enrichedPhotos].sort((a, b) => {
      const scoreA =
        (a.visualMetrics?.warmth ?? 0.5) * 0.4 +
        (a.visualMetrics?.brightness ?? 0.5) * 0.35 +
        (a.visualMetrics?.saturation ?? 0.5) * 0.25;
      const scoreB =
        (b.visualMetrics?.warmth ?? 0.5) * 0.4 +
        (b.visualMetrics?.brightness ?? 0.5) * 0.35 +
        (b.visualMetrics?.saturation ?? 0.5) * 0.25;
      return scoreA - scoreB;
    });

    for (let i = 0; i < N; i++) {
      const photo = sortedByColor[i];
      result[i] = {
        ...photo,
        lockedDuration: dynamicDurations ? dynamicDurations[i] : photo.lockedDuration,
        transitionType: dynamicTransitions ? dynamicTransitions[i] : photo.transitionType,
      };
    }

    return result;
  }

  if (pattern === 'rising-climax') {
    // Pattern D: Rising Climax (Energy steadily increases towards the end)
    const sortedByEnergyAsc = [...enrichedPhotos].sort(
      (a, b) => (a.visualMetrics?.energyScore || 0) - (b.visualMetrics?.energyScore || 0)
    );

    for (let i = 0; i < N; i++) {
      const photo = sortedByEnergyAsc[i];
      result[i] = {
        ...photo,
        lockedDuration: dynamicDurations ? dynamicDurations[i] : photo.lockedDuration,
        transitionType: dynamicTransitions ? dynamicTransitions[i] : photo.transitionType,
      };
    }

    return result;
  }

  // Pattern A ('narrative') & Pattern B ('audio-peak'):
  // Calculate target energy profile across the timeline
  const targetEnergies: { index: number; time: number; energy: number }[] = [];

  for (let i = 0; i < N; i++) {
    const time = windowStart + (i + 0.5) * segDuration;
    let energy = song.rms;

    if (song.energyCurve && song.energyCurve.length > 0) {
      const pt = song.energyCurve.find((p) => Math.abs(p.time - time) < segDuration);
      if (pt) energy = pt.energy;
    }

    let multiplier = 1.0;
    if (pattern === 'narrative') {
      // Natural narrative arc weight
      const progress = i / (N - 1);
      if (progress < 0.15) {
        multiplier = 0.75;
      } else if (progress > 0.45 && progress < 0.75) {
        multiplier = 1.25;
      } else if (progress > 0.90) {
        multiplier = 0.8;
      }
    }
    // For 'audio-peak', multiplier remains 1.0 (pure raw waveform peaks)

    targetEnergies.push({
      index: i,
      time,
      energy: energy * multiplier,
    });
  }

  // Rank timeline slots by target energy
  const slotRankings = [...targetEnergies].sort((a, b) => b.energy - a.energy);

  // Rank photos by visual energy score
  const photoRankings = [...enrichedPhotos].sort(
    (a, b) => (b.visualMetrics?.energyScore || 0) - (a.visualMetrics?.energyScore || 0)
  );

  // Assign photos to slots
  for (let rank = 0; rank < N; rank++) {
    const slot = slotRankings[rank];
    const photo = photoRankings[rank];
    result[slot.index] = {
      ...photo,
      lockedDuration: dynamicDurations ? dynamicDurations[slot.index] : photo.lockedDuration,
      transitionType: dynamicTransitions ? dynamicTransitions[slot.index] : photo.transitionType,
    };
  }

  return result;
}

/**
 * Randomly shuffles the photos using Fisher-Yates algorithm.
 */
export function shufflePhotos(photos: PhotoItem[]): PhotoItem[] {
  const arr = [...photos];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Natural alphanumeric sort by photo filename for chronological/album sequencing.
 */
export function sortPhotosByName(photos: PhotoItem[]): PhotoItem[] {
  return [...photos].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}
