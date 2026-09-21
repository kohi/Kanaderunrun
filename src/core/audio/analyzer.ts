import { guess } from 'web-audio-beat-detector';
import type { PresetType, SongData } from '../../types/project';

/**
 * Calculates RMS (Root Mean Square) energy of an audio buffer across time windows (e.g., 0.5s window).
 */
export function calculateRMSEnergy(
  audioBuffer: AudioBuffer,
  windowDuration: number = 0.5
): { overallRMS: number; curve: { time: number; energy: number }[] } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData0 = audioBuffer.getChannelData(0);
  const hasChannel1 = audioBuffer.numberOfChannels > 1;
  const channelData1 = hasChannel1 ? audioBuffer.getChannelData(1) : null;
  const totalSamples = channelData0.length;

  const windowSize = Math.floor(sampleRate * windowDuration);
  const curve: { time: number; energy: number }[] = [];

  let totalSquaredSum = 0;
  let totalSampleCount = 0;

  for (let offset = 0; offset < totalSamples; offset += windowSize) {
    const end = Math.min(offset + windowSize, totalSamples);
    const count = end - offset;
    let windowSquaredSum = 0;

    for (let i = offset; i < end; i++) {
      let sample = channelData0[i];
      if (channelData1) {
        sample = (sample + channelData1[i]) * 0.5;
      }
      windowSquaredSum += sample * sample;
    }

    const windowRMS = Math.sqrt(windowSquaredSum / count);
    const time = offset / sampleRate;
    curve.push({ time, energy: windowRMS });

    totalSquaredSum += windowSquaredSum;
    totalSampleCount += count;
  }

  const overallRMS = totalSampleCount > 0 ? Math.sqrt(totalSquaredSum / totalSampleCount) : 0;

  return { overallRMS, curve };
}

/**
 * Fallback peak-based BPM and beat detector using energy onset detection.
 */
export function fallbackDetectBeats(
  audioBuffer: AudioBuffer
): { bpm: number; offset: number; beats: number[] } {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  // Compute energy per 20ms block
  const blockSize = Math.floor(sampleRate * 0.02);
  const blockCount = Math.floor(data.length / blockSize);
  const energies = new Float32Array(blockCount);

  for (let i = 0; i < blockCount; i++) {
    let sum = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const v = data[start + j];
      sum += v * v;
    }
    energies[i] = Math.sqrt(sum / blockSize);
  }

  // Find local peaks
  const peaks: number[] = [];
  const localWindow = 10; // ~200ms
  for (let i = localWindow; i < blockCount - localWindow; i++) {
    let isMax = true;
    const val = energies[i];
    if (val < 0.05) continue; // Noise floor
    for (let j = i - localWindow; j <= i + localWindow; j++) {
      if (j !== i && energies[j] >= val) {
        isMax = false;
        break;
      }
    }
    if (isMax) {
      peaks.push((i * blockSize) / sampleRate);
    }
  }

  // Estimate BPM from intervals between peaks
  let estimatedBpm = 120;
  if (peaks.length >= 4) {
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const diff = peaks[i] - peaks[i - 1];
      if (diff >= 0.3 && diff <= 1.2) {
        intervals.push(diff);
      }
    }
    if (intervals.length > 0) {
      const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
      estimatedBpm = Math.round(60 / medianInterval);
      if (estimatedBpm < 60) estimatedBpm *= 2;
      if (estimatedBpm > 180) estimatedBpm /= 2;
    }
  }

  const offset = peaks.length > 0 ? peaks[0] : 0;
  const beatInterval = 60 / estimatedBpm;
  const beats: number[] = [];
  for (let t = offset; t < duration; t += beatInterval) {
    beats.push(t);
  }

  return { bpm: estimatedBpm, offset, beats };
}

/**
 * Determine vibe preset based on BPM and RMS energy.
 * ゆったり: BPM < 90 または RMS < 0.10
 * アップテンポ: BPM >= 130 かつ RMS >= 0.16
 * スタンダード: それ以外
 */
export function determineVibePreset(bpm: number, overallRMS: number): PresetType {
  if (bpm < 90 || overallRMS < 0.10) {
    return 'slow';
  }
  if (bpm >= 130 && overallRMS >= 0.16) {
    return 'up';
  }
  return 'standard';
}

/**
 * Analyzes loaded audio file: decodes AudioBuffer, detects BPM & beats, computes RMS energy.
 */
export async function analyzeAudioFile(
  file: File,
  onProgress?: (step: string) => void
): Promise<SongData> {
  onProgress?.('音声データをデコード中...');

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    await audioContext.close();
    throw new Error('音声ファイルのデコードに失敗しました。破損しているか非対応フォーマットの可能性があります。');
  }

  onProgress?.('BPM・ビート位置を解析中...');

  let bpm = 120;
  let firstBeatOffset = 0;
  let beats: number[] = [];

  try {
    const guessResult = await guess(audioBuffer);
    bpm = Math.round(guessResult.bpm || 120);
    firstBeatOffset = Math.max(0, guessResult.offset || 0);

    // Validate BPM range (typical 50-220)
    if (bpm < 40 || bpm > 240) {
      const fallback = fallbackDetectBeats(audioBuffer);
      bpm = fallback.bpm;
      firstBeatOffset = fallback.offset;
      beats = fallback.beats;
    } else {
      const beatInterval = 60 / bpm;
      const duration = audioBuffer.duration;
      for (let t = firstBeatOffset; t < duration; t += beatInterval) {
        beats.push(t);
      }
    }
  } catch (e) {
    console.warn('web-audio-beat-detector failed, falling back to peak detector:', e);
    const fallback = fallbackDetectBeats(audioBuffer);
    bpm = fallback.bpm;
    firstBeatOffset = fallback.offset;
    beats = fallback.beats;
  }

  onProgress?.('エネルギー（RMS）を解析中...');
  const { overallRMS, curve: energyCurve } = calculateRMSEnergy(audioBuffer, 0.5);

  const detectedPreset = determineVibePreset(bpm, overallRMS);
  const duration = audioBuffer.duration;

  await audioContext.close();

  return {
    file,
    name: file.name.replace(/\.[^/.]+$/, ''),
    duration,
    audioBuffer,
    bpm,
    firstBeatOffset,
    beats,
    rms: overallRMS,
    energyCurve,
    trimStart: 0,
    trimEnd: duration,
    detectedPreset,
  };
}
