import type { PhotoItem, ProjectConfig, ProjectSection, TimingSong, Timeline, SongData } from '../../types/project';
import { planSectionDurations } from './durationPlan';
import { generateTimeline } from './generator';

export function createSection(index: number): ProjectSection {
  return {
    id: crypto.randomUUID(), name: `セクション ${index}`, durationMode: 'music', duration: 30,
    song: null, photos: [], audioFadeIn: 1, audioFadeOut: 1.5, musicVolume: 1,
    coverSettings: { titleCover: { enabled: false, duration: 3 }, endingCover: { enabled: false, duration: 3.5 } },
  };
}

export function sectionDuration(section: ProjectSection): number {
  const value = section.durationMode === 'music' && section.song
    ? section.song.trimEnd - section.song.trimStart : section.duration;
  return Number.isFinite(value) ? Math.max(0.1, value) : 30;
}

export function sectionTimingSong(section: ProjectSection): TimingSong {
  const duration = sectionDuration(section);
  const start = section.song?.trimStart ?? 0;
  const musicEnd = Math.min(start + duration, section.song?.trimEnd ?? duration);
  return {
    duration, trimStart: 0, trimEnd: duration, bpm: section.song?.bpm ?? 120,
    rms: section.song?.rms ?? 0, beats: section.song?.beats.filter(t => t >= start && t <= musicEnd).map(t => t - start) ?? [],
    energyCurve: section.song?.energyCurve.filter(p => p.time >= start && p.time <= musicEnd).map(p => ({ ...p, time: p.time - start })) ?? [],
  };
}

/** Read beats from the same absolute music position used by continuous playback. */
export function continuousTimingSong(section: ProjectSection, song: SongData | null, sectionStart: number): TimingSong {
  const duration = sectionDuration(section);
  const start = (song?.trimStart ?? 0) + sectionStart;
  const end = Math.min(start + duration, song?.trimEnd ?? 0);
  return { duration, trimStart: 0, trimEnd: duration, bpm: song?.bpm ?? 120, rms: song?.rms ?? 0,
    beats: song?.beats.filter(t => t >= start && t <= end).map(t => t - start) ?? [],
    energyCurve: song?.energyCurve.filter(p => p.time >= start && p.time <= end).map(p => ({ ...p, time: p.time - start })) ?? [] };
}

export function mediaDuration(photo: PhotoItem): number | undefined {
  return photo.video ? photo.video.trimEnd - photo.video.trimStart : photo.lockedDuration;
}

export function sectionContentDuration(section: ProjectSection): number {
  return section.photos.reduce((sum, photo) => sum + (mediaDuration(photo) ?? 3), 0)
    + Object.values(section.coverSettings).reduce((sum, cover) => sum + (cover.enabled && cover.photo ? cover.duration : 0), 0);
}

/** Fixed clips/cards retain their exact lengths. Only unpinned photos absorb free time. */
export function buildSectionTimeline(section: ProjectSection, settings: Pick<ProjectConfig, 'preset' | 'seed' | 'transitionStyle'>, timingSong = sectionTimingSong(section)): Timeline {
  const duration = sectionDuration(section);
  const photos = section.photos.map(photo => ({ ...photo, lockedDuration: mediaDuration(photo) }));
  const timeline = generateTimeline(timingSong, photos, settings.preset, settings.seed,
    settings.transitionStyle, false, 0, false, 0, section.coverSettings);
  // Validate independently of the legacy one-song allocator, including the all-fixed case.
  timeline.messages = [];
  timeline.isExceeded = false;
  timeline.hasInsufficientTime = false;
  const fail = (text: string) => {
    timeline.isExceeded = true;
    timeline.hasInsufficientTime = true;
    timeline.messages.push({ type: 'error', title: section.name, text });
  };
  for (const cover of Object.values(section.coverSettings)) {
    if (cover.enabled && !cover.photo) fail('有効な表紙・エンドカードに画像を設定してください。');
    if (cover.enabled && (!Number.isFinite(cover.duration) || cover.duration < 1)) fail('表紙・エンドカードは1秒以上にしてください。');
  }
  for (const photo of photos) {
    if (photo.video && (photo.video.trimStart < 0 || photo.video.trimEnd > photo.video.duration + 0.001 || !(photo.video.trimEnd > photo.video.trimStart))) {
      fail(`「${photo.name}」の動画の使用範囲を確認してください。`);
    }
  }
  const fixedTime = photos.reduce((sum, p) => sum + (p.lockedDuration ?? 0), 0)
    + Object.values(section.coverSettings).reduce((sum, c) => sum + (c.enabled && c.photo ? c.duration : 0), 0);
  const autoCount = photos.filter(p => !p.lockedDuration).length;
  const remaining = duration - fixedTime;
  if (!timeline.segments.length) fail('写真・動画・表紙のいずれかを追加してください。');
  if (remaining < -0.001) fail(`素材の固定秒数（${fixedTime.toFixed(1)}秒）がセクション（${duration.toFixed(1)}秒）を超えています。`);
  else if (autoCount && remaining / autoCount < 1.5 - 0.001) fail('自動配分の写真は1枚あたり1.5秒以上必要です。セクションを長くするか、素材を減らしてください。');
  else if (!autoCount && remaining > 0.001 && timeline.segments.length) fail(`固定素材の合計は${fixedTime.toFixed(1)}秒です。「素材の長さに合わせる」を選ぶか、秒数が自動の写真を追加してください。`);
  let cursor = 0;
  let idealEnd = 0;
  const beats = timingSong.beats;
  timeline.segments = timeline.segments.map((segment, index, all) => {
    const photo = photos[segment.photoIndex];
    const length = segment.isTitleCover ? section.coverSettings.titleCover.duration
      : segment.isEndingCover ? section.coverSettings.endingCover.duration
      : photo?.lockedDuration ?? Math.max(0.1, remaining / Math.max(1, autoCount));
    // Beat alignment is only allowed between two automatic photos, never across a fixed clip.
    idealEnd += length;
    let end = idealEnd;
    const next = all[index + 1];
    if (photo && !photo.lockedDuration && next && !next.isEndingCover && !photos[next.photoIndex]?.lockedDuration) {
      const nearest = beats.reduce((a, b) => Math.abs(b - end) < Math.abs(a - end) ? b : a, end + 1000);
      if (Math.abs(nearest - end) < 0.15 && nearest - cursor >= 1.5 && idealEnd + length - nearest >= 1.5) end = nearest;
    }
    const result = { ...segment, startTime: cursor, endTime: end, duration: end - cursor,
      crossfadeDuration: photo?.video || photos[next?.photoIndex ?? -1]?.video || index === all.length - 1
        ? 0 : Math.min(segment.crossfadeDuration, length / 3) };
    cursor = end;
    return result;
  });
  timeline.unlockedAverageTime = autoCount ? Math.max(0, remaining / autoCount) : 0;
  timeline.averageInterval = timeline.unlockedAverageTime;
  return timeline;
}

export function composeSections(sections: ProjectSection[], settings: Pick<ProjectConfig, 'preset' | 'seed' | 'transitionStyle' | 'fadeIn' | 'fadeInDuration' | 'fadeOut' | 'fadeOutDuration' | 'musicMode' | 'continuousSong'>) {
  const plan = planSectionDurations(sections, settings.musicMode ?? 'sections', settings.continuousSong ?? null);
  sections = plan.sections;
  const photos: PhotoItem[] = [];
  let cursor = 0;
  const sectionRanges = sections.map(section => {
    const range = { id: section.id, name: section.name, startTime: cursor, duration: sectionDuration(section) };
    cursor += range.duration;
    return range;
  });
  const timelines = sections.map((section, i) => buildSectionTimeline(section, settings,
    settings.musicMode === 'continuous' ? continuousTimingSong(section, settings.continuousSong ?? null, sectionRanges[i].startTime) : sectionTimingSong(section)));
  const segments = timelines.flatMap((timeline, i) => timeline.segments.map(segment => {
    const section = sections[i];
    const media = segment.isTitleCover ? section.coverSettings.titleCover.photo
      : segment.isEndingCover ? section.coverSettings.endingCover.photo : section.photos[segment.photoIndex];
    const photoIndex = photos.length;
    if (media) photos.push(media);
    return { ...segment, sectionId: section.id, photoIndex, photoId: media?.id ?? segment.photoId,
      isTitleCover: false, isEndingCover: false,
      startTime: segment.startTime + sectionRanges[i].startTime,
      endTime: segment.endTime + sectionRanges[i].startTime };
  }));
  const timeline: Timeline = {
    totalDuration: cursor, segments, isExceeded: plan.messages.length > 0 || timelines.some(t => t.isExceeded),
    hasInsufficientTime: plan.messages.length > 0 || timelines.some(t => t.hasInsufficientTime),
    messages: [...plan.messages, ...timelines.flatMap(t => t.messages)], maxPhotosAllowed: timelines.reduce((sum, t) => sum + t.maxPhotosAllowed, 0),
    averageInterval: cursor / Math.max(1, photos.length), lockedCount: 0, lockedTotalTime: 0,
    unlockedCount: 0, unlockedAverageTime: 0,
    headFadeDuration: settings.fadeIn ? settings.fadeInDuration : 0,
    tailFadeDuration: settings.fadeOut ? settings.fadeOutDuration : 0,
  };
  return { photos, timeline, sectionRanges };
}
