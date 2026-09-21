import type { ProjectConfig } from '../../types/project';

export interface AudioClip {
  buffer: AudioBuffer;
  start: number;
  offset: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  volume: number;
}

/** This shared schedule drives both live playback and offline MP4 audio. */
export function getAudioClips(project: ProjectConfig): AudioClip[] {
  const clips: AudioClip[] = [];
  if (project.musicMode === 'continuous') {
    const song = project.continuousSong;
    const total = project.timeline?.totalDuration ?? 0;
    if (song) {
      const duration = Math.min(total, song.trimEnd - song.trimStart, song.audioBuffer.duration - song.trimStart);
      if (duration > 0) clips.push({ buffer: song.audioBuffer, start: 0, offset: song.trimStart, duration,
        fadeIn: 0, fadeOut: duration < total && project.fadeOut ? Math.min(project.fadeOutDuration, duration / 2) : 0,
        volume: project.continuousVolume ?? 1 });
    }
  } else if (project.sections && project.sectionRanges) {
    for (const range of project.sectionRanges) {
      const section = project.sections.find(s => s.id === range.id);
      if (!section?.song) continue;
      const song = section.song;
      const duration = Math.min(range.duration, song.trimEnd - song.trimStart, song.audioBuffer.duration - song.trimStart);
      if (duration <= 0) continue;
      clips.push({ buffer: song.audioBuffer, start: range.startTime, offset: song.trimStart, duration,
        fadeIn: Math.min(section.audioFadeIn, duration / 2), fadeOut: Math.min(section.audioFadeOut, duration / 2), volume: section.musicVolume });
    }
  } else if (project.song) {
    clips.push({ buffer: project.song.audioBuffer, start: 0, offset: project.song.trimStart,
      duration: project.song.trimEnd - project.song.trimStart, fadeIn: 0, fadeOut: 0, volume: 1 });
  }
  for (const segment of project.timeline?.segments ?? []) {
    const video = project.photos[segment.photoIndex]?.video;
    if (video?.audioBuffer && video.volume > 0) {
      const duration = Math.min(segment.duration, video.trimEnd - video.trimStart, video.audioBuffer.duration - video.trimStart);
      if (duration > 0) clips.push({ buffer: video.audioBuffer, start: segment.startTime, offset: video.trimStart,
        duration, fadeIn: Math.min(0.05, duration / 2), fadeOut: Math.min(0.1, duration / 2), volume: video.volume });
    }
  }
  return clips;
}

export function clipGain(clip: Pick<AudioClip, 'duration' | 'fadeIn' | 'fadeOut' | 'volume'>, t: number): number {
  if (t < 0 || t > clip.duration) return 0;
  const gain = Math.min(1, clip.fadeIn > 0 ? t / clip.fadeIn : 1,
    clip.fadeOut > 0 ? (clip.duration - t) / clip.fadeOut : 1);
  // Smoothstep has zero slope at the endpoints, avoiding a hard audio cut.
  const x = Math.max(0, gain);
  return clip.volume * x * x * (3 - 2 * x);
}

function automateGain(param: AudioParam, from: number, duration: number, at: number, gainAt: (t: number) => number) {
  const count = Math.max(2, Math.ceil(duration * 100) + 1);
  const curve = Float32Array.from({ length: count }, (_, i) => gainAt(from + duration * i / (count - 1)));
  param.setValueCurveAtTime(curve, at, Math.max(0.001, duration));
}

export function scheduleComposition(ctx: BaseAudioContext, project: ProjectConfig, offset = 0): AudioBufferSourceNode[] {
  const total = project.timeline?.totalDuration ?? 0;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const head = project.fadeIn ? project.fadeInDuration : 0;
  const tail = project.fadeOut ? project.fadeOutDuration : 0;
  automateGain(master.gain, offset, Math.max(0.001, total - offset), now,
    t => clipGain({ duration: total, fadeIn: head, fadeOut: tail, volume: 1 }, t));
  const sources: AudioBufferSourceNode[] = [];
  let remainingSources = 0;
  for (const clip of getAudioClips(project)) {
    const skip = Math.max(0, offset - clip.start);
    const duration = clip.duration - skip;
    if (duration <= 0) continue;
    const at = now + Math.max(0, clip.start - offset);
    const source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(master);
    automateGain(gain.gain, skip, duration, at, t => clipGain(clip, t));
    source.start(at, clip.offset + skip, duration);
    remainingSources++;
    source.onended = () => { source.disconnect(); gain.disconnect(); if (--remainingSources === 0) master.disconnect(); };
    sources.push(source);
  }
  if (!sources.length) master.disconnect();
  return sources;
}

export async function renderCompositionAudio(project: ProjectConfig): Promise<AudioBuffer> {
  const duration = project.timeline?.totalDuration ?? 0;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * 48000)), 48000);
  scheduleComposition(ctx, project);
  return ctx.startRendering();
}

export class CompositionPlayer {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private offset = 0;
  private started = 0;
  private playing = false;
  private frame = 0;
  private generation = 0;
  private project: ProjectConfig;
  private onTime: (t: number) => void;
  private onEnded: () => void;

  constructor(project: ProjectConfig, onTime: (t: number) => void, onEnded: () => void) {
    this.project = project; this.onTime = onTime; this.onEnded = onEnded;
  }
  get isPlaying() { return this.playing; }
  get currentTime() { return this.offset + (this.playing && this.ctx ? this.ctx.currentTime - this.started : 0); }
  async play() {
    if (this.playing) return;
    const generation = ++this.generation;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (generation !== this.generation) return;
    const total = this.project.timeline?.totalDuration ?? 0;
    if (this.offset >= total) this.offset = 0;
    this.sources = scheduleComposition(this.ctx, this.project, this.offset);
    this.started = this.ctx.currentTime;
    this.playing = true;
    const tick = () => {
      if (!this.playing) return;
      const t = this.currentTime;
      if (t >= total) { this.pause(); this.offset = 0; this.onEnded(); return; }
      this.onTime(t);
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  pause() {
    ++this.generation;
    this.offset = this.currentTime;
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.sources.forEach(source => { try { source.stop(); } catch { /* already ended */ } source.disconnect(); });
    this.sources = [];
  }
  seek(t: number) {
    const playing = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(t, this.project.timeline?.totalDuration ?? 0));
    this.onTime(this.offset);
    if (playing) void this.play();
  }
  dispose() { this.pause(); void this.ctx?.close(); this.ctx = null; }
}
