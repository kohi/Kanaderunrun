import type { PhotoItem, ProjectSection, Timeline, TimingSong } from '../../types/project';
import { calculateSongFlowTransitions } from './photoAnalyzer';

export type PhotoUpdate = PhotoItem[] | ((current: PhotoItem[]) => PhotoItem[]);
export const MEDIA_DRAG_TYPE = 'application/x-kanaderu-media';

export function updateSectionPhotos(sections: ProjectSection[], sectionId: string, update: PhotoUpdate) {
  return sections.map(section => section.id === sectionId
    ? { ...section, photos: typeof update === 'function' ? update(section.photos) : update } : section);
}
export function moveMedia(photos: PhotoItem[], sourceId: string, targetId: string): PhotoItem[] {
  const from = photos.findIndex(photo => photo.id === sourceId), to = photos.findIndex(photo => photo.id === targetId);
  if (from < 0 || to < 0 || from === to) return photos;
  const result = [...photos]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
}
export function replaceMedia(photos: PhotoItem[], targetId: string, replacement: PhotoItem): PhotoItem[] {
  return photos.map(photo => photo.id === targetId ? { ...replacement, lockedDuration: photo.lockedDuration, transitionType: photo.transitionType } : photo);
}
export function autoEffects(photos: PhotoItem[], song: TimingSong, timeline: Timeline | null): PhotoItem[] {
  return photos.map((photo, index) => {
    if (photo.video) return photo;
    const segment = timeline?.segments.find(s => s.photoId === photo.id);
    const at = segment ? (segment.startTime + segment.endTime) / 2 : 0;
    const energy = song.energyCurve.reduce((best, point) => Math.abs(point.time - at) < Math.abs(best.time - at) ? point : best, { time: Infinity, energy: song.rms }).energy;
    const options = calculateSongFlowTransitions(photos.length, { ...song, rms: energy, energyCurve: [] });
    return { ...photo, transitionType: options[index] };
  });
}
