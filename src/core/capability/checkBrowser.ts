import type { CapabilityStatus } from '../../types/project';

/**
 * Prioritized list of H.264 profile/level codec strings.
 * Note: 1080p requires at least Level 4.0 (0x28) or higher. Level 3.1 (0x1f) is rejected by macOS VideoToolbox for 1080p.
 */
export const H264_CANDIDATE_CODECS = [
  'avc1.420028', // Baseline Profile Level 4.0 (Widely compatible 1080p)
  'avc1.4d002a', // Main Profile Level 4.2 (macOS hardware standard)
  'avc1.640028', // High Profile Level 4.0
  'avc1.64002a', // High Profile Level 4.2
  'avc1.420029', // Baseline Profile Level 4.1
  'avc1.420033', // Baseline Profile Level 5.1
  'avc1.4d0028', // Main Profile Level 4.0
  'avc1.42001f', // Baseline Profile Level 3.1 (720p fallback)
];

export const AAC_CANDIDATE_CODECS = [
  'mp4a.40.2', // AAC-LC (Universal MP4 standard)
  'mp4a.40.02',
  'mp4a.40.5', // HE-AAC
  'mp4a.67',
];

/**
 * Finds the first supported H.264 video codec string for the specified dimensions and bitrate.
 */
export async function findSupportedH264Codec(
  width: number = 1920,
  height: number = 1080,
  bitrate: number = 8_000_000
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof window.VideoEncoder === 'undefined') {
    return null;
  }

  for (const codec of H264_CANDIDATE_CODECS) {
    try {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: 30,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) {
        return codec;
      }
    } catch {
      // try next codec
    }
  }

  return null;
}

/**
 * Finds the first supported AAC audio codec string.
 */
export async function findSupportedAACCodec(
  sampleRate: number = 48000,
  numberOfChannels: number = 2,
  bitrate: number = 192000
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof window.AudioEncoder === 'undefined') {
    return null;
  }

  for (const codec of AAC_CANDIDATE_CODECS) {
    try {
      const config: AudioEncoderConfig = {
        codec,
        sampleRate,
        numberOfChannels,
        bitrate,
      };
      const support = await AudioEncoder.isConfigSupported(config);
      if (support.supported) {
        return codec;
      }
    } catch {
      // try next codec
    }
  }

  return null;
}

/**
 * Checks if the current browser environment supports WebCodecs VideoEncoder (H.264)
 * and AudioEncoder (AAC) required for client-side MP4 generation.
 */
export async function checkBrowserCapabilities(): Promise<CapabilityStatus> {
  const isChromium =
    typeof navigator !== 'undefined' &&
    /Chrome|Edg|Chromium/i.test(navigator.userAgent) &&
    !/Firefox|Safari(?!\s*\/.*Chrome)/i.test(navigator.userAgent);

  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      videoEncoderSupported: false,
      audioEncoderSupported: false,
      isChromium,
      errorMessage: 'サーバーサイド環境では実行できません。',
    };
  }

  // 1. Check basic WebCodecs API availability
  const hasVideoEncoder = typeof window.VideoEncoder !== 'undefined';
  const hasAudioEncoder = typeof window.AudioEncoder !== 'undefined';

  if (!hasVideoEncoder || !hasAudioEncoder) {
    return {
      isSupported: false,
      videoEncoderSupported: hasVideoEncoder,
      audioEncoderSupported: hasAudioEncoder,
      isChromium,
      errorMessage:
        'お使いのブラウザは WebCodecs API（動画・音声エンコード）に対応していません。最新の Google Chrome または Microsoft Edge（デスクトップ版）をご利用ください。',
    };
  }

  // 2. Check candidate H.264 video encoder support (test with 1080p and 720p)
  const videoCodec1080p = await findSupportedH264Codec(1920, 1080);
  const videoCodec720p = videoCodec1080p || (await findSupportedH264Codec(1280, 720));
  const videoOk = !!videoCodec720p;

  // 3. Check candidate AAC audio encoder support
  const audioCodec = await findSupportedAACCodec();
  const audioOk = !!audioCodec;

  if (!videoOk || !audioOk) {
    let detail = '';
    if (!videoOk && !audioOk) detail = 'H.264映像エンコーダーおよびAAC音声エンコーダー';
    else if (!videoOk) detail = 'H.264映像エンコーダー';
    else detail = 'AAC音声エンコーダー';

    return {
      isSupported: false,
      videoEncoderSupported: videoOk,
      audioEncoderSupported: audioOk,
      isChromium,
      errorMessage: `お使いの環境では ${detail} がサポートされていません。LINEやスマートフォン等での再生互換性のため、最新のデスクトップ版 Google Chrome または Microsoft Edge を推奨します。`,
    };
  }

  return {
    isSupported: true,
    videoEncoderSupported: true,
    audioEncoderSupported: true,
    isChromium,
  };
}
