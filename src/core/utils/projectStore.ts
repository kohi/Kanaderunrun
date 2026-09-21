import type { CoverSettings, PhotoItem, ProjectConfig, ProjectSection, SongData } from '../../types/project';
import { loadAndProcessImage } from './imageLoader';
import { loadVideo } from '../video/media';
import { releaseAsset } from './resources';

type SavedPhoto = Pick<PhotoItem, 'id' | 'file' | 'lockedDuration' | 'transitionType'> & {
  video?: Pick<NonNullable<PhotoItem['video']>, 'trimStart' | 'trimEnd' | 'volume'>;
};
type SavedSong = Omit<SongData, 'audioBuffer'>;
type SavedCover = { enabled: boolean; duration: number; photo?: SavedPhoto };
type SavedSection = Omit<ProjectSection, 'photos' | 'song' | 'coverSettings'> & {
  photos: SavedPhoto[]; song: SavedSong | null;
  coverSettings: { titleCover: SavedCover; endingCover: SavedCover };
};
export type EditorSettings = Pick<ProjectConfig, 'seed' | 'aspectRatio' | 'videoQuality' | 'preset' | 'transitionStyle' | 'fadeIn' | 'fadeInDuration' | 'fadeOut' | 'fadeOutDuration'>;
export interface EditorState {
  settings: EditorSettings; sections: ProjectSection[]; continuousSong: SongData | null; draftSong: SongData | null;
  musicMode: 'sections' | 'continuous'; continuousVolume: number; activeId: string; currentStep: 1 | 2 | 3;
}
interface SavedProject extends Omit<EditorState, 'sections' | 'continuousSong' | 'draftSong'> {
  version: 1; savedAt: number; sections: SavedSection[]; continuousSong: SavedSong | null; draftSong: SavedSong | null; draftConfirmed: boolean;
}
function savePhoto(photo: PhotoItem): SavedPhoto {
  return { id: photo.id, file: photo.file, lockedDuration: photo.lockedDuration, transitionType: photo.transitionType,
    video: photo.video ? { trimStart: photo.video.trimStart, trimEnd: photo.video.trimEnd, volume: photo.video.volume } : undefined };
}
function saveSong(song: SongData | null): SavedSong | null {
  if (!song) return null;
  const { file, name, duration, bpm, firstBeatOffset, beats, rms, energyCurve, trimStart, trimEnd, detectedPreset } = song;
  return { file, name, duration, bpm, firstBeatOffset, beats, rms, energyCurve, trimStart, trimEnd, detectedPreset };
}
export function serializeProject(state: EditorState): SavedProject {
  const cover = (value: CoverSettings['titleCover']): SavedCover => ({ enabled: value.enabled, duration: value.duration, photo: value.photo ? savePhoto(value.photo) : undefined });
  return { ...state, version: 1, savedAt: Date.now(), continuousSong: saveSong(state.continuousSong), draftSong: saveSong(state.draftSong),
    draftConfirmed: !!state.continuousSong && !!state.draftSong && state.continuousSong.audioBuffer === state.draftSong.audioBuffer
      && state.continuousSong.trimStart === state.draftSong.trimStart && state.continuousSong.trimEnd === state.draftSong.trimEnd,
    sections: state.sections.map(section => ({ ...section, song: saveSong(section.song), photos: section.photos.map(savePhoto),
      coverSettings: { titleCover: cover(section.coverSettings.titleCover), endingCover: cover(section.coverSettings.endingCover) } })) };
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kanaderu-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('保存領域を開けません。他のタブを閉じて再試行してください。'));
  });
}
export async function saveProject(state: EditorState): Promise<number> {
  const snapshot = serializeProject(state);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('保存が中断されました。空き容量を確認してください。'));
      transaction.onerror = () => reject(transaction.error);
      transaction.objectStore('projects').put(snapshot, 'latest');
    });
    return snapshot.savedAt;
  } finally { db.close(); }
}
async function readSnapshot(): Promise<SavedProject | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('projects', 'readonly').objectStore('projects').get('latest');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
export async function savedProjectDate() { return (await readSnapshot())?.savedAt ?? null; }
export async function restoreProject(onProgress: (message: string) => void): Promise<EditorState> {
  const saved = await readSnapshot();
  if (!saved) throw new Error('保存したプロジェクトがありません。');
  if (saved.version !== 1 || !saved.sections.length) throw new Error('この保存データには対応していません。');
  const loaded: PhotoItem[] = [];
  const audioCache = new Map<File, AudioBuffer>();
  const song = async (value: SavedSong | null): Promise<SongData | null> => {
    if (!value) return null;
    onProgress(`楽曲を復元中: ${value.file.name}`);
    let buffer = audioCache.get(value.file);
    if (!buffer) {
      const context = new AudioContext();
      try { buffer = await context.decodeAudioData(await value.file.arrayBuffer()); audioCache.set(value.file, buffer); }
      finally { await context.close(); }
    }
    return { ...value, audioBuffer: buffer };
  };
  const photo = async (value: SavedPhoto): Promise<PhotoItem> => {
    onProgress(`素材を復元中: ${value.file.name}`);
    const item = value.video ? await loadVideo(value.file) : await loadAndProcessImage(value.file);
    loaded.push(item);
    return { ...item, id: value.id, lockedDuration: value.lockedDuration, transitionType: value.transitionType,
      video: item.video && value.video ? { ...item.video, ...value.video } : undefined };
  };
  const cover = async (value: SavedCover) => ({ ...value, photo: value.photo ? await photo(value.photo) : undefined });
  try {
    const sections: ProjectSection[] = [];
    for (const section of saved.sections) {
      const photos: PhotoItem[] = [];
      for (const value of section.photos) photos.push(await photo(value));
      sections.push({ ...section, photos, song: await song(section.song),
        coverSettings: { titleCover: await cover(section.coverSettings.titleCover), endingCover: await cover(section.coverSettings.endingCover) } });
    }
    const continuousSong = await song(saved.continuousSong);
    return { ...saved, sections, continuousSong, draftSong: saved.draftConfirmed ? continuousSong : await song(saved.draftSong) };
  } catch (error) { loaded.forEach(releaseAsset); throw error; }
}
