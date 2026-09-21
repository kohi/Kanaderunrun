export type AspectRatio = '16:9' | '9:16';

export type VideoQuality = '720p' | '1080p' | '4k';

export type PresetType = 'slow' | 'standard' | 'up';

export type TransitionType =
  | 'crossfade'
  | 'flash'
  | 'zoom'
  | 'slide'
  | 'dip-black'
  | 'light-leak';

export type TransitionStyle =
  | 'auto' // Preset & energy adaptive mix
  | 'dynamic' // Punchy mix (flash, zoom, slide)
  | 'flash' // Beat flashes
  | 'zoom' // Crash zooms
  | 'cinematic' // Light leak & dip to black
  | 'crossfade'; // Smooth crossfade only

export type SongFlowPattern =
  | 'narrative' // Pattern A: Standard Narrative Arc (Intro -> Climax -> Outro)
  | 'audio-peak' // Pattern B: Raw Audio Waveform Peak Sync
  | 'color-flow' // Pattern C: Color & Mood Gradient Progression
  | 'rising-climax'; // Pattern D: Rising Climax towards the end

export interface PresetConfig {
  id: PresetType;
  label: string;
  subLabel: string;
  zoomStart: number;
  zoomEnd: number;
  crossfadeDuration: number;
  description: string;
}

export interface SongData {
  file: File;
  name: string;
  duration: number; // in seconds
  audioBuffer: AudioBuffer;
  bpm: number;
  firstBeatOffset: number; // in seconds
  beats: number[]; // beat timestamps in seconds
  rms: number; // overall RMS energy (0.0 - 1.0)
  energyCurve: { time: number; energy: number }[];
  trimStart: number; // in seconds (F16)
  trimEnd: number; // in seconds (F16)
  detectedPreset: PresetType;
}

export interface PhotoVisualMetrics {
  brightness: number; // 0.0 - 1.0
  saturation: number; // 0.0 - 1.0
  warmth: number; // 0.0 - 1.0 (warm vs cool tones)
  contrast: number; // 0.0 - 1.0
  energyScore: number; // 0.0 - 1.0 (composite vibrancy & contrast)
}

export type TimingSong = Pick<SongData, "duration" | "trimStart" | "trimEnd" | "bpm" | "beats" | "rms" | "energyCurve">;

export interface VideoClip {
  url: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  audioBuffer?: AudioBuffer;
}

export interface PhotoItem {
  video?: VideoClip;
  id: string;
  file: File;
  name: string;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  bitmap: ImageBitmap | HTMLCanvasElement;
  lockedDuration?: number; // Optional fixed display duration in seconds (undefined = auto)
  transitionType?: TransitionType; // Optional custom transition override
  visualMetrics?: PhotoVisualMetrics;
}

export interface CoverImageItem {
  id: string;
  file: File;
  name: string;
  originalWidth: number;
  originalHeight: number;
  previewUrl: string;
  bitmap: ImageBitmap | HTMLCanvasElement;
}

export interface CoverSettings {
  titleCover: {
    enabled: boolean;
    photo?: CoverImageItem;
    duration: number; // in seconds (default 3.0s)
  };
  endingCover: {
    enabled: boolean;
    photo?: CoverImageItem;
    duration: number; // in seconds (default 3.5s)
  };
}

export type PanDirection = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'center';
export type ZoomDirection = 'in' | 'out';

export interface PhotoAnimationConfig {
  zoomDirection: ZoomDirection;
  panDirection: PanDirection;
  panIntensity: number; // 0.0 - 1.0
}

export interface TimelineSegment {
  sectionId?: string;
  photoIndex: number;
  photoId: string;
  startTime: number; // in seconds (movie time axis)
  endTime: number; // in seconds
  duration: number; // in seconds
  crossfadeDuration: number; // in seconds
  transitionType: TransitionType;
  animation: PhotoAnimationConfig;
  isLocked?: boolean;
  isTitleCover?: boolean;
  isEndingCover?: boolean;
}

export interface TimelineMessage {
  type: 'info' | 'warning' | 'error';
  title: string;
  text: string;
}

export interface Timeline {
  totalDuration: number; // movie duration in seconds (T +/- 0.1s)
  segments: TimelineSegment[];
  isExceeded: boolean; // d < 1.5s or insufficient time warning
  hasInsufficientTime: boolean; // true if locked durations exceed total song time
  maxPhotosAllowed: number; // floor(T / 1.5)
  averageInterval: number; // average duration for unlocked photos
  lockedCount: number;
  lockedTotalTime: number;
  unlockedCount: number;
  unlockedAverageTime: number;
  messages: TimelineMessage[];
  headFadeDuration: number; // 0 if disabled, or e.g. 0.5s
  tailFadeDuration: number; // 0 if disabled, or e.g. 2.0s
}

export interface ProjectSection {
  id: string;
  name: string;
  durationMode: "music" | "custom" | "auto";
  duration: number;
  song: SongData | null;
  photos: PhotoItem[];
  coverSettings: CoverSettings;
  audioFadeIn: number;
  audioFadeOut: number;
  musicVolume: number;
}

export interface SectionRange {
  id: string;
  name: string;
  startTime: number;
  duration: number;
}

export interface ProjectConfig {
  musicMode?: "sections" | "continuous";
  continuousSong?: SongData | null;
  continuousVolume?: number;
  sections?: ProjectSection[];
  sectionRanges?: SectionRange[];
  seed: number; // Seed for deterministic PRNG
  aspectRatio: AspectRatio;
  videoQuality: VideoQuality;
  preset: PresetType;
  transitionStyle: TransitionStyle;
  fadeIn: boolean;
  fadeInDuration: number; // in seconds (e.g. 0.5s, 1.0s)
  fadeOut: boolean;
  fadeOutDuration: number; // in seconds (e.g. 2.0s, 3.0s)
  coverSettings: CoverSettings;
  song: SongData | null;
  photos: PhotoItem[];
  timeline: Timeline | null;
}

export interface UserSettings {
  schemaVersion: number;
  aspect: AspectRatio;
  lastVideoQuality?: VideoQuality;
  lastPreset: PresetType;
  lastTransitionStyle?: TransitionStyle;
  fadeIn?: boolean;
  fadeInDuration?: number;
  fadeOut?: boolean;
  fadeOutDuration?: number;
}

export interface RenderDimensions {
  width: number;
  height: number;
}

export interface CapabilityStatus {
  isSupported: boolean;
  videoEncoderSupported: boolean;
  audioEncoderSupported: boolean;
  isChromium: boolean;
  errorMessage?: string;
}

export interface ExportProgress {
  state: 'idle' | 'preparing' | 'encoding' | 'muxing' | 'completed' | 'cancelled' | 'error';
  encodedFrames: number;
  totalFrames: number;
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  error?: string;
  blob?: Blob;
  downloadUrl?: string;
  filename?: string;
}
