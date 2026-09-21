import { describe, expect, it } from 'vitest';
import { planSectionDurations } from '../core/timeline/durationPlan';
import { composeSections, createSection } from '../core/timeline/sections';
import type { PhotoItem, SongData } from '../types/project';
const track = (seconds: number) => ({ trimStart: 5, trimEnd: 5 + seconds, duration: 5 + seconds, beats:[], energyCurve:[], bpm:120, rms:0 } as unknown as SongData);
const auto = () => ({ ...createSection(1), durationMode: 'auto' as const });
const manual = (duration: number) => ({ ...createSection(1), durationMode: 'custom' as const, duration });
const photo = { id:'photo', bitmap:{} as ImageBitmap, name:'photo', file:new File([],'photo'), previewUrl:'', originalWidth:10, originalHeight:10 } satisfies PhotoItem;

describe('music duration budget', () => {
  it('marks the whole duration as provisional until music is selected', () => {
    const plan = planSectionDurations([auto(),auto()],'continuous',null);
    expect(plan.target).toBeNull(); expect(plan.remaining).toBeNull(); expect(plan.messages[0].title).toBe('全体時間は未確定');
  });
  it('divides the trimmed song among automatic sections', () => {
    const plan = planSectionDurations([auto(),auto(),auto()],'continuous',track(60));
    expect(plan.sections.map(s=>s.duration)).toEqual([20,20,20]); expect(plan.total).toBe(60); expect(plan.messages).toEqual([]);
  });
  it('reserves manual time and divides only the remainder', () => {
    const plan = planSectionDurations([manual(12.5),auto(),auto()],'continuous',track(60));
    expect(plan.sections.map(s=>s.duration)).toEqual([12.5,23.75,23.75]); expect(plan.remaining).toBe(47.5);
  });
  it('recalculates after trimming, adding and deleting without changing stored values', () => {
    const sections = [manual(5),auto()];
    expect(planSectionDurations(sections,'continuous',track(20)).sections[1].duration).toBe(15);
    expect(planSectionDurations(sections,'continuous',track(10)).sections[1].duration).toBe(5);
    expect(planSectionDurations([...sections,auto()],'continuous',track(20)).sections.map(s=>s.duration)).toEqual([5,7.5,7.5]);
    expect(sections[1].duration).toBe(30);
  });
  it('honours the minimum time for fixed videos and photos in each section', () => {
    const a = auto(); a.photos=[photo,{...photo,id:'video',video:{url:'blob:video',duration:8,trimStart:0,trimEnd:8,volume:0}}];
    const b = auto(); b.photos=[photo];
    const plan = planSectionDurations([a,b],'continuous',track(12));
    expect(plan.sections.map(s=>s.duration)).toEqual([9.5,2.5]); expect(plan.messages).toEqual([]);
  });
  it('does not stretch fixed-only material to absorb remaining time', () => {
    const a=auto();a.photos=[{...photo,lockedDuration:4}];
    const plan=planSectionDurations([a,auto()],'continuous',track(10));
    expect(plan.sections.map(s=>s.duration)).toEqual([4,6]);
    expect(planSectionDurations([a],'continuous',track(10)).difference).toBe(6);
  });
  it('blocks manual durations exceeding the music instead of producing a silent tail', () => {
    const plan=planSectionDurations([manual(8),manual(5)],'continuous',track(10));
    expect(plan.difference).toBe(-3); expect(plan.messages[0].title).toContain('超過');
  });
  it('blocks unallocated time when all sections have manual durations', () => {
    const plan=planSectionDurations([manual(3),manual(5)],'continuous',track(10));
    expect(plan.difference).toBe(2); expect(plan.messages[0].title).toContain('余って');
  });
  it('reports insufficient time when minimum media durations cannot fit', () => {
    const a=auto();a.photos=[photo,photo];
    const plan=planSectionDurations([manual(8),a],'continuous',track(10));
    expect(plan.total).toBe(11); expect(plan.messages).toHaveLength(1);
  });
  it('keeps fractional allocation exact across many sections', () => {
    const plan=planSectionDurations(Array.from({length:7},auto),'continuous',track(10));
    expect(plan.total).toBeCloseTo(10,10); expect(plan.messages).toEqual([]);
  });
  it('keeps independent section music unchanged', () => {
    const a={...createSection(1),song:track(7)};
    const plan=planSectionDurations([a,manual(4)],'sections',null);
    expect(plan.total).toBe(11); expect(plan.messages).toEqual([]);
  });
  it('uses the resolved budget for the actual output timeline and blocks incomplete budgets', () => {
    const a=auto(),b=auto(); a.photos=[photo]; b.photos=[photo];
    const settings={seed:1,preset:'standard',transitionStyle:'crossfade',fadeIn:false,fadeInDuration:0,fadeOut:false,fadeOutDuration:0,musicMode:'continuous',continuousSong:track(10)} as const;
    const result=composeSections([a,b],settings);
    expect(result.sectionRanges.map(r=>r.duration)).toEqual([5,5]); expect(result.timeline.totalDuration).toBe(10); expect(result.timeline.isExceeded).toBe(false);
    expect(composeSections([{...a,durationMode:'custom',duration:3},{...b,durationMode:'custom',duration:4}],settings).timeline.isExceeded).toBe(true);
  });
});
