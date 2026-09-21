import type { CoverImageItem, PhotoItem, ProjectSection } from '../../types/project';

export function sectionAssets(sections: ProjectSection[]): Map<string, PhotoItem | CoverImageItem> {
  return new Map(sections.flatMap(section => [
    ...section.photos, section.coverSettings.titleCover.photo, section.coverSettings.endingCover.photo,
  ].filter((photo): photo is PhotoItem => !!photo)).map(photo => [photo.id, photo]));
}

export function releaseAsset(photo: PhotoItem | CoverImageItem) {
  if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
  if ('video' in photo && photo.video) URL.revokeObjectURL(photo.video.url);
  if ('close' in photo.bitmap) photo.bitmap.close();
}
