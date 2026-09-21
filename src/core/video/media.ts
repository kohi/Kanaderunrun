import { activeSegmentIndex } from '../timeline/activeSegment';
import type { PhotoItem, ProjectConfig } from '../../types/project';

function waitFor(video: HTMLVideoElement, event: string, action: () => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timeout); video.removeEventListener(event, done); video.removeEventListener('error', error); signal?.removeEventListener('abort', abort); };
    const done = () => { clean(); resolve(); };
    const error = () => { clean(); reject(new Error('動画を読み込めません。ブラウザで再生可能なMP4 / WebMを選んでください。')); };
    const abort = () => { clean(); reject(new Error('処理がキャンセルされました。')); };
    const timeout = setTimeout(error, 20000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', error, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else action();
  });
}

async function openVideo(url: string, signal?: AbortSignal) {
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  try { await waitFor(video, 'loadeddata', () => { video.src = url; video.load(); }, signal); }
  catch (error) { video.removeAttribute('src'); video.load(); throw error; }
  return video;
}

export async function loadVideo(file: File): Promise<PhotoItem> {
  const url = URL.createObjectURL(file);
  let video: HTMLVideoElement | undefined;
  try {
    video = await openVideo(url);
    if (!Number.isFinite(video.duration) || video.duration < 0.1 || !video.videoWidth) throw new Error('動画の長さ・映像を取得できませんでした。');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('動画のサムネイルを作成できませんでした。');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let audioBuffer: AudioBuffer | undefined;
    const audio = new AudioContext();
    try { audioBuffer = await audio.decodeAudioData(await file.arrayBuffer()); } catch { /* silent/unsupported audio is explicitly shown in the editor */ }
    finally { await audio.close(); }
    return { id: crypto.randomUUID(), file, name: file.name, originalWidth: video.videoWidth, originalHeight: video.videoHeight,
      previewUrl: canvas.toDataURL('image/jpeg', 0.8), bitmap: canvas,
      video: { url, duration: video.duration, trimStart: 0, trimEnd: video.duration, volume: 0, audioBuffer } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
  finally { if (video) { video.pause(); video.removeAttribute('src'); video.load(); } }
}

export function videoSourceTime(photo: PhotoItem, segmentStart: number, time: number) {
  const clip = photo.video!;
  return Math.min(clip.trimEnd - 0.001, Math.max(clip.trimStart, clip.trimStart + time - segmentStart));
}

/** Separate decoders per preview/export prevent concurrent seeks on the same video. */
export class VideoFrames {
  private elements = new Map<string, HTMLVideoElement>();
  private controller = new AbortController();

  async prepare(project: ProjectConfig, time: number, playing = false): Promise<Map<string, HTMLVideoElement>> {
    const index = activeSegmentIndex(project, time);
    const active = index >= 0 && project.timeline ? [project.timeline.segments[index]] : [];
    const ids = new Set(active.map(s => s.photoId));
    for (const [id, element] of this.elements) {
      if (!ids.has(id)) { element.pause(); element.removeAttribute('src'); element.load(); this.elements.delete(id); }
      else if (!playing) element.pause();
    }
    const frames = new Map<string, HTMLVideoElement>();
    for (const segment of active) {
      const photo = project.photos[segment.photoIndex];
      if (!photo?.video) continue;
      let element = this.elements.get(photo.id);
      if (!element) {
        element = await openVideo(photo.video.url, this.controller.signal);
        if (this.controller.signal.aborted) { element.removeAttribute('src'); element.load(); throw new Error('処理がキャンセルされました。'); }
        this.elements.set(photo.id, element);
      }
      const target = videoSourceTime(photo, segment.startTime, time);
      if (Math.abs(element.currentTime - target) > (playing && !element.paused ? 0.15 : 0.001)) {
        await waitFor(element, 'seeked', () => { element.currentTime = target; }, this.controller.signal);
      }
      if (playing && element.paused) await element.play();
      frames.set(photo.id, element);
    }
    return frames;
  }
  pause() { this.elements.forEach(video => video.pause()); }
  dispose() {
    this.controller.abort();
    this.elements.forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    this.elements.clear();
  }
}
