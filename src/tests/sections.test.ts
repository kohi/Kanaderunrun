import { describe, it, expect } from 'vitest';
import { buildSectionTimeline, composeSections, continuousTimingSong, createSection, sectionDuration, sectionTimingSong } from '../core/timeline/sections';
import { clipGain, getAudioClips } from '../core/audio/composition';
import { videoSourceTime } from '../core/video/media';
import type { PhotoItem, ProjectConfig, ProjectSection, SongData } from '../types/project';

const settings = { seed: 123, preset: 'standard', transitionStyle: 'crossfade', aspectRatio: '16:9', videoQuality: '720p', fadeIn: false, fadeInDuration: 0.5, fadeOut: false, fadeOutDuration: 2 } as const;
const photo = (id: string, lockedDuration?: number): PhotoItem => ({ id, name: id, file: new File([], id), bitmap: {} as ImageBitmap, previewUrl: '', originalWidth: 320, originalHeight: 180, lockedDuration });
const song = (name: string): SongData => ({ file: new File([], name), name, duration: 20, audioBuffer: { duration: 20 } as AudioBuffer, trimStart: 3, trimEnd: 9, bpm: 120, firstBeatOffset: 0, beats: [2, 3, 3.5, 5, 9, 10], rms: 0.2, energyCurve: [{ time: 3.5, energy: 0.2 }], detectedPreset: 'standard' });
const section = (id: string, duration: number, photos = [photo(id)]): ProjectSection => ({ ...createSection(1), id, name: id, durationMode: 'custom', duration, photos });
const video = (): PhotoItem => ({ ...photo('video'), video: { url: 'blob:video', duration: 20, trimStart: 2, trimEnd: 6, volume: 0 } });
function project(sections: ProjectSection[]): ProjectConfig { return { ...settings, ...composeSections(sections, settings), sections, song: null, coverSettings: createSection(1).coverSettings }; }

describe('section composition', () => {
  it('uses trimmed music duration or an independent custom duration', () => {
    const s = { ...section('a', 12), durationMode: 'music' as const, song: song('a') };
    expect(sectionDuration(s)).toBe(6);
    expect(sectionDuration({ ...s, durationMode: 'custom' })).toBe(12);
    expect(sectionTimingSong(s).beats).toEqual([0, 0.5, 2, 6]);
    expect(sectionTimingSong(s).energyCurve).toEqual([{ time: 0.5, energy: 0.2 }]);
  });
  it('places each section’s own cover and ending at exact offsets', () => {
    const a = section('a', 10), b = section('b', 8);
    for (const s of [a,b]) s.coverSettings = { titleCover: { enabled: true, duration: 2, photo: photo(`${s.id}-title`) }, endingCover: { enabled: true, duration: 1, photo: photo(`${s.id}-end`) } };
    const p = project([a,b]);
    expect(p.timeline?.isExceeded).toBe(false);
    expect(p.photos.map(p => p.id)).toEqual(['a-title','a','a-end','b-title','b','b-end']);
    expect(p.timeline?.segments.map(s => [s.startTime,s.endTime])).toEqual([[0,2],[2,9],[9,10],[10,12],[12,17],[17,18]]);
    expect(p.timeline?.segments.every(s => !s.isTitleCover && !s.isEndingCover)).toBe(true);
  });
  it('reordering moves music, covers and media together and recalculates offsets', () => {
    const a = section('a', 8), b = section('b', 5); a.song = song('music-a'); b.song = song('music-b');
    const p = project([b,a]);
    expect(p.sectionRanges?.map(r => [r.id,r.startTime])).toEqual([['b',0],['a',5]]);
    expect(p.photos.map(p => p.id)).toEqual(['b','a']);
    expect(getAudioClips(p).map(c => [c.buffer,c.start,c.offset,c.duration])).toEqual([[b.song.audioBuffer,0,3,5],[a.song.audioBuffer,5,3,6]]);
  });
  it('keeps videos and pinned photos exact, distributing only remaining time', () => {
    const s = section('a', 15, [photo('a'),video(),photo('b',2),photo('c')]);
    const t = buildSectionTimeline(s,settings);
    expect(t.isExceeded).toBe(false);
    expect(t.segments.map(s => s.duration)).toEqual([4.5,4,2,4.5]);
    expect(t.segments[0].crossfadeDuration).toBe(0);
    expect(t.segments[1].crossfadeDuration).toBe(0);
    expect(t.segments.at(-1)?.endTime).toBe(15);
  });
  it('does not move a fixed duration when neighbouring automatic photos snap to beats', () => {
    const s = section('a', 13, [photo('a'),photo('b'),photo('c',3)]); s.song = song('music');
    const t = buildSectionTimeline(s,settings);
    expect(t.segments[2].duration).toBe(3);
    expect(t.segments[2].endTime).toBe(13);
  });
  it('allows a section consisting solely of covers', () => {
    const s = section('covers',3,[]); s.coverSettings.titleCover = { enabled:true, duration:3, photo:photo('cover') };
    expect(project([s]).timeline?.isExceeded).toBe(false);
    expect(project([s]).photos).toHaveLength(1);
  });
  it('allows video-only sections without music', () => {
    const p = project([section('video',4,[video()])]);
    expect(p.timeline?.isExceeded).toBe(false);
    expect(getAudioClips(p)).toEqual([]);
  });
  it.each([
    ['empty',section('empty',5,[])],
    ['overfull',section('overfull',3,[video()])],
    ['underfilled fixed',section('underfilled',8,[video()])],
    ['too many photos',section('short',2,[photo('a'),photo('b')])],
  ])('blocks invalid timing: %s', (_,s) => { const t = buildSectionTimeline(s,settings); expect(t.isExceeded).toBe(true); expect(t.messages.length).toBeGreaterThan(0); });
  it('blocks enabled covers without a file', () => {
    const s = section('missing',5); s.coverSettings.titleCover.enabled = true;
    expect(project([s]).timeline?.isExceeded).toBe(true);
  });
  it('preserves section settings and source arrays during compilation', () => {
    const s = section('a',8,[photo('a'),video()]);
    const original = s.photos.slice(); project([s]);
    expect(s.photos).toEqual(original); expect(s.photos[1].lockedDuration).toBeUndefined();
  });
});

describe('section audio and video ranges', () => {
  it('fades to and from silence with a continuous envelope', () => {
    const clip = { duration: 8, fadeIn: 1, fadeOut: 2, volume: 0.8 };
    expect(clipGain(clip,0)).toBe(0); expect(clipGain(clip,8)).toBe(0);
    expect(clipGain(clip,0.5)).toBeCloseTo(0.4); expect(clipGain(clip,7)).toBeCloseTo(0.4);
    expect(clipGain(clip,3)).toBe(0.8); expect(clipGain(clip,9)).toBe(0);
  });
  it('clips a long song to the section and limits fades for short sections', () => {
    const s = section('a',2); s.song = song('track'); s.audioFadeIn = 10; s.audioFadeOut = 10;
    const clip = getAudioClips(project([s]))[0];
    expect(clip.duration).toBe(2); expect(clip.fadeIn).toBe(1); expect(clip.fadeOut).toBe(1);
  });
  it('ends a short music selection without repeating into the next section', () => {
    const a = section('a',12); a.song = song('a');
    const b = section('b',4); b.song = song('b');
    const clips = getAudioClips(project([a,b]));
    expect(clips.map(c => [c.start,c.duration])).toEqual([[0,6],[12,4]]);
  });
  it('mixes video audio only when explicitly enabled, from the same trim range', () => {
    const v = video(); v.video!.audioBuffer = { duration:20 } as AudioBuffer;
    const s = section('a',7,[photo('a'),v]);
    expect(getAudioClips(project([s]))).toHaveLength(0);
    v.video!.volume = 0.5;
    expect(getAudioClips(project([s]))[0]).toMatchObject({ start:3, offset:2, duration:4, volume:0.5 });
  });
  it('maps timeline time into the source video without overrunning the trim', () => {
    expect(videoSourceTime(video(),10,11.5)).toBe(3.5);
    expect(videoSourceTime(video(),10,9)).toBe(2);
    expect(videoSourceTime(video(),10,15)).toBeCloseTo(5.999);
  });
});

describe('continuous music across sections', () => {
  it('creates a single uninterrupted clip and ignores individual section tracks', () => {
    const a = section('a', 2), b = section('b', 3);
    a.song = song('individual-a'); b.song = song('individual-b');
    const shared = song('shared');
    const p = { ...project([a,b]), musicMode: 'continuous' as const, continuousSong: shared, continuousVolume: 0.7 };
    const clips = getAudioClips(p);
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ start:0, offset:3, duration:5, volume:0.7, fadeIn:0, fadeOut:0 });
    expect(clips[0].buffer).toBe(shared.audioBuffer);
    expect(clipGain(clips[0], 2 - 0.001)).toBeCloseTo(0.7);
    expect(clipGain(clips[0], 2 + 0.001)).toBeCloseTo(0.7);
  });
  it('keeps the same music source position after reordering sections', () => {
    const a = section('a',2), b = section('b',3), shared = song('shared');
    const before = getAudioClips({ ...project([a,b]), musicMode:'continuous', continuousSong:shared });
    const after = getAudioClips({ ...project([b,a]), musicMode:'continuous', continuousSong:shared });
    expect(after).toEqual(before);
  });
  it('does not fall back to section songs when the shared song is removed', () => {
    const a = section('a',3); a.song = song('individual');
    expect(getAudioClips({ ...project([a]), musicMode:'continuous', continuousSong:null })).toEqual([]);
  });
  it('fades a short shared song at its actual end, without looping it', () => {
    const p = { ...project([section('a',10)]), musicMode:'continuous' as const, continuousSong:song('shared'), fadeOut:true, fadeOutDuration:1 };
    expect(getAudioClips(p)[0]).toMatchObject({ duration:6, fadeOut:1 });
  });
});

it('uses the continuing song position for beat alignment in later sections', () => {
  const shared = song('shared');
  const timing = continuousTimingSong(section('later', 3), shared, 2);
  expect(timing.beats).toEqual([0]);
  expect(continuousTimingSong(section('past-end', 3), shared, 8).beats).toEqual([]);
});
