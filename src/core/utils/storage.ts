import type { TransitionStyle, UserSettings, VideoQuality } from '../../types/project';

const SETTINGS_KEY = 'kanaderu.v1.settings';

const DEFAULT_SETTINGS: UserSettings = {
  schemaVersion: 1,
  aspect: '16:9',
  lastVideoQuality: '1080p',
  lastPreset: 'standard',
  lastTransitionStyle: 'dynamic',
  fadeIn: true,
  fadeInDuration: 0.5,
  fadeOut: true,
  fadeOutDuration: 2.0,
};

const VALID_TRANSITION_STYLES: TransitionStyle[] = [
  'auto',
  'dynamic',
  'flash',
  'zoom',
  'cinematic',
  'crossfade',
];

const VALID_VIDEO_QUALITIES: VideoQuality[] = ['720p', '1080p', '4k'];

export function loadSettings(): UserSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      aspect: parsed.aspect === '9:16' ? '9:16' : '16:9',
      lastVideoQuality: VALID_VIDEO_QUALITIES.includes(parsed.lastVideoQuality)
        ? parsed.lastVideoQuality
        : '1080p',
      lastPreset: ['slow', 'standard', 'up'].includes(parsed.lastPreset)
        ? parsed.lastPreset
        : 'standard',
      lastTransitionStyle: VALID_TRANSITION_STYLES.includes(parsed.lastTransitionStyle)
        ? parsed.lastTransitionStyle
        : 'dynamic',
      fadeIn: parsed.fadeIn !== undefined ? !!parsed.fadeIn : true,
      fadeInDuration: typeof parsed.fadeInDuration === 'number' ? parsed.fadeInDuration : 0.5,
      fadeOut: parsed.fadeOut !== undefined ? !!parsed.fadeOut : true,
      fadeOutDuration: typeof parsed.fadeOutDuration === 'number' ? parsed.fadeOutDuration : 2.0,
    };
  } catch (e) {
    console.warn('Failed to load localStorage settings:', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<UserSettings>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save localStorage settings:', e);
  }
}
