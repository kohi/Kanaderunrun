import type { ProjectSection, SongData, TimelineMessage } from '../../types/project';

const EPSILON = 0.001;
const durationOf = (section: ProjectSection) => section.durationMode === 'music' && section.song
  ? section.song.trimEnd - section.song.trimStart : section.duration;

function minimumTime(section: ProjectSection) {
  const covers = Object.values(section.coverSettings).reduce((sum, cover) => sum + (cover.enabled && cover.photo ? cover.duration : 0), 0);
  const photos = section.photos.reduce((sum, photo) => sum + (photo.video ? photo.video.trimEnd - photo.video.trimStart : photo.lockedDuration ?? 1.5), 0);
  return Math.max(0.1, covers + photos);
}

/** Stored manual values remain untouched; automatic durations are derived again after every edit. */
export function planSectionDurations(sections: ProjectSection[], mode: 'sections' | 'continuous', song: SongData | null) {
  const target = mode === 'continuous' && song ? song.trimEnd - song.trimStart : null;
  const messages: TimelineMessage[] = [];
  const auto = sections.filter(section => mode === 'continuous' && section.durationMode === 'auto');
  const manualTotal = sections.filter(section => !auto.includes(section)).reduce((sum, section) => sum + durationOf(section), 0);
  const remaining = target === null ? null : target - manualTotal;
  const allocated = new Map<string, number>();
  if (target !== null && auto.length) {
    // Fixed-only sections cannot absorb spare time. Other sections share time equally,
    // with a lower bound for their videos, covers and automatically timed photos.
    const flexible = auto.filter(section => !section.photos.length && !Object.values(section.coverSettings).some(cover => cover.enabled && cover.photo)
      || section.photos.some(photo => !photo.video && !photo.lockedDuration));
    let pool = remaining!;
    for (const section of auto.filter(section => !flexible.includes(section))) {
      const duration = minimumTime(section); allocated.set(section.id, duration); pool -= duration;
    }
    let pending = [...flexible];
    while (pending.length) {
      const share = pool / pending.length;
      const constrained = pending.filter(section => minimumTime(section) > share);
      if (!constrained.length) {
        pending.forEach((section, i) => allocated.set(section.id, i === pending.length - 1 ? pool - share * i : share));
        break;
      }
      for (const section of constrained) {
        const duration = minimumTime(section); allocated.set(section.id, duration); pool -= duration;
      }
      pending = pending.filter(section => !allocated.has(section.id));
    }
  }
  const resolved = sections.map(section => ({ ...section,
    duration: allocated.get(section.id) ?? durationOf(section),
    durationMode: section.durationMode === 'auto' ? 'custom' as const : section.durationMode,
  }));
  const total = resolved.reduce((sum, section) => sum + durationOf(section), 0);
  const difference = target === null ? null : target - total;
  if (mode === 'continuous' && !song) messages.push({ type: 'error', title: '全体時間は未確定', text: '全体の楽曲を読み込み、使用範囲を設定してください。表示中の自動配分は仮の時間です。' });
  if (difference !== null && difference < -EPSILON) messages.push({ type: 'error', title: '楽曲の時間を超過しています', text: `${(-difference).toFixed(2)}秒不足しています。手動指定の秒数・素材の固定秒数を減らすか、楽曲の使用範囲を長くしてください。` });
  if (difference !== null && difference > EPSILON) messages.push({ type: 'error', title: '楽曲の時間が余っています', text: `${difference.toFixed(2)}秒が未配分です。セクションを「残り時間から自動配分」にするか、手動の秒数を増やしてください。固定素材だけの場合は、自動の写真を追加するか楽曲をトリミングしてください。` });
  return { sections: resolved, target, manualTotal, remaining, total, difference, autoCount: auto.length, messages };
}
export type DurationPlan = ReturnType<typeof planSectionDurations>;
