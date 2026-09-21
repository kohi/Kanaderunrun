import { describe, expect, it, vi } from 'vitest';
vi.mock('../core/utils/imageLoader', () => ({ loadAndProcessImage: vi.fn() }));
import { autoEffects, moveMedia, replaceMedia, updateSectionPhotos } from '../core/utils/mediaEdits';
import { activeSegmentIndex } from '../core/timeline/activeSegment';
import { createSection, composeSections } from '../core/timeline/sections';
import { serializeProject } from '../core/utils/projectStore';
import type { PhotoItem, ProjectConfig } from '../types/project';
const photo = (id: string): PhotoItem => ({ id, name:id, file:new File(['pixels'],`${id}.png`), bitmap:{} as ImageBitmap, previewUrl:'blob:preview', originalWidth:10, originalHeight:10 });
const settings = { seed:1, preset:'standard', transitionStyle:'dynamic', aspectRatio:'16:9', videoQuality:'720p', fadeIn:false, fadeOut:false, fadeInDuration:0.5, fadeOutDuration:2 } as const;
const song = { duration:10, trimStart:0, trimEnd:10, beats:[], bpm:120, rms:0.2, energyCurve:[] };

describe('section media isolation', () => {
  it('applies delayed imports only to their originating section, using the latest list', () => {
    const a=createSection(1), b=createSection(2);a.photos=[photo('a')];b.photos=[photo('b')];
    const first=updateSectionPhotos([a,b],a.id,current=>[...current,photo('first')]);
    const second=updateSectionPhotos(first,a.id,current=>[...current,photo('delayed')]);
    expect(second[0].photos.map(p=>p.id)).toEqual(['a','first','delayed']); expect(second[1]).toBe(b);
    expect(updateSectionPhotos([b],a.id,current=>[...current,photo('orphan')])).toEqual([b]);
  });
  it('reorders by stable IDs and ignores foreign IDs', () => {
    const photos=[photo('a'),photo('b'),photo('c')];
    expect(moveMedia(photos,'a','c').map(p=>p.id)).toEqual(['b','c','a']);
    expect(moveMedia(photos,'foreign','c')).toBe(photos);expect(photos[0].id).toBe('a');
  });
  it('replaces only the intended photo after the list moves, preserving its settings', () => {
    const a={...photo('a'),lockedDuration:3,transitionType:'zoom' as const};
    const result=replaceMedia([photo('b'),a],'a',photo('new'));
    expect(result.map(p=>p.id)).toEqual(['b','new']);expect(result[1]).toMatchObject({lockedDuration:3,transitionType:'zoom'});
  });
  it('does not display an earlier section photo in a gap or at the next boundary', () => {
    const a={...createSection(1),durationMode:'custom' as const,duration:5,photos:[{...photo('a'),lockedDuration:2}]};
    const b={...createSection(2),durationMode:'custom' as const,duration:5,photos:[photo('b')]};
    const project:ProjectConfig={...settings,...composeSections([a,b],settings),song:null,coverSettings:a.coverSettings};
    expect(activeSegmentIndex(project,1)).toBe(0);expect(activeSegmentIndex(project,3)).toBe(-1);expect(activeSegmentIndex(project,5)).toBe(1);
    project.timeline!.segments[0].endTime=8;
    expect(activeSegmentIndex(project,6)).toBe(1);
  });
  it('changes effects without changing order, durations or video settings', () => {
    const original=[{...photo('a'),lockedDuration:2},photo('b'),{...photo('v'),video:{url:'blob:v',duration:3,trimStart:0,trimEnd:3,volume:0}}];
    const result=autoEffects(original,song,null);
    expect(result.map(p=>p.id)).toEqual(['a','b','v']);expect(result[0].lockedDuration).toBe(2);
    expect(result[0].transitionType).toBeDefined();expect(original[0]).not.toHaveProperty('transitionType');expect(result[2]).toBe(original[2]);
  });
  it('saves media files and configuration without transient browser objects', () => {
    const section=createSection(1);section.photos=[{...photo('a'),lockedDuration:3,transitionType:'slide'}];section.coverSettings.titleCover={enabled:true,duration:2,photo:photo('cover')};
    const snapshot=serializeProject({settings,sections:[section],continuousSong:null,draftSong:null,musicMode:'continuous',continuousVolume:0.7,activeId:section.id,currentStep:2});
    const restored=structuredClone(snapshot);
    expect(restored.sections[0].photos[0].file.size).toBe(6);
    expect(restored.sections[0].photos[0]).not.toHaveProperty('bitmap');expect(restored.sections[0].photos[0]).not.toHaveProperty('previewUrl');
    expect(restored.sections[0].photos[0]).toMatchObject({lockedDuration:3,transitionType:'slide'});
    expect(restored.sections[0].coverSettings.titleCover.duration).toBe(2);expect(restored.continuousVolume).toBe(0.7);
  });
});
