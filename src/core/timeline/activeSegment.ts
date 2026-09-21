import type { ProjectConfig } from '../../types/project';

/** Never borrow a segment from another section, even while an invalid draft has gaps/overlaps. */
export function activeSegmentIndex(project: ProjectConfig, time: number): number {
  const timeline = project.timeline;
  if (!timeline) return -1;
  const section = project.sectionRanges?.find(range => time >= range.startTime && time < range.startTime + range.duration);
  return timeline.segments.findIndex(segment => (!project.sectionRanges || segment.sectionId === section?.id)
    && time >= segment.startTime && time < segment.endTime);
}
