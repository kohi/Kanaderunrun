import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ExportProgress, ProjectConfig } from '../../types/project';
import { renderCompositionAudio } from '../audio/composition';
import { VideoFrames } from '../video/media';
import { RESOLUTIONS_BY_QUALITY, render } from '../renderer/canvasRenderer';
import { findSupportedAACCodec, findSupportedH264Codec } from '../capability/checkBrowser';

export interface ExportController {
  cancel: () => void;
}

/**
 * Formats date as YYYYMMDD for output filename.
 */
function getFormattedDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Exports the project into an MP4 video file using WebCodecs (H.264 + AAC) and mp4-muxer.
 */
export function exportToMp4(
  project: ProjectConfig,
  onProgress: (progress: ExportProgress) => void
): { promise: Promise<{ blob: Blob; filename: string }>; controller: ExportController } {
  let isCancelled = false;
  let videoEncoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;

  const frames = new VideoFrames();
  let encoderError: Error | null = null;
  const controller: ExportController = {
    cancel: () => {
      isCancelled = true;
      frames.dispose();
    },
  };

  const promise = (async () => {
    const song = project.song;
    const timeline = project.timeline;

    if (!timeline || timeline.isExceeded || !project.photos.length) {
      throw new Error('プロジェクトの素材が不足しています。');
    }

    const fps = 30;
    const totalDuration = timeline.totalDuration;
    const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));
    const quality = project.videoQuality || '1080p';
    const qualityMap = RESOLUTIONS_BY_QUALITY[quality] || RESOLUTIONS_BY_QUALITY['1080p'];
    const targetDimensions = qualityMap[project.aspectRatio] || qualityMap['16:9'];
    const { width, height } = targetDimensions;

    const bitrateMap: Record<string, number> = {
      '720p': 6_000_000,
      '1080p': 12_000_000,
      '4k': 28_000_000,
    };
    const videoBitrate = bitrateMap[quality] || 12_000_000;

    const startTimeMs = performance.now();

    onProgress({
      state: 'preparing',
      encodedFrames: 0,
      totalFrames,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
    });

    // Determine supported codecs dynamically for the given resolution
    const videoCodec = (await findSupportedH264Codec(width, height)) || 'avc1.420028';
    const audioCodec = (await findSupportedAACCodec()) || 'mp4a.40.2';

    // 1. Setup MP4 Muxer with ArrayBufferTarget
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'avc',
        width,
        height,
      },
      audio: {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000,
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    // 2. Initialize VideoEncoder (H.264)
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        encoderError = e;
      },
    });

    videoEncoder.configure({
      codec: videoCodec,
      width,
      height,
      bitrate: videoBitrate,
      framerate: fps,
    });

    // 3. Initialize AudioEncoder (AAC)
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: (e) => {
        encoderError = e;
      },
    });

    audioEncoder.configure({
      codec: audioCodec,
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 192000,
    });

    // 4. Resample audio to 48kHz stereo
    const resampledAudio = await renderCompositionAudio(project);

    if (isCancelled) {
      videoEncoder.close();
      audioEncoder.close();
      onProgress({
        state: 'cancelled',
        encodedFrames: 0,
        totalFrames,
        percent: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });
      throw new Error('エクスポートがキャンセルされました。');
    }

    // 5. Encode Audio in chunks of 1024 frames (f32-planar)
    const audioChannel0 = resampledAudio.getChannelData(0);
    const audioChannel1 = resampledAudio.numberOfChannels > 1 ? resampledAudio.getChannelData(1) : audioChannel0;
    const totalAudioSamples = audioChannel0.length;
    const samplesPerChunk = 1024;
    const sampleRate = 48000;

    for (let offset = 0; offset < totalAudioSamples; offset += samplesPerChunk) {
      if (isCancelled) break;
      if (encoderError) throw encoderError;

      const frameCount = Math.min(samplesPerChunk, totalAudioSamples - offset);
      // Planar layout: Channel 0 data followed by Channel 1 data
      const planarData = new Float32Array(frameCount * 2);

      for (let i = 0; i < frameCount; i++) {
        const sampleIdx = offset + i;

        planarData[i] = (audioChannel0[sampleIdx] || 0);
        planarData[frameCount + i] = (audioChannel1[sampleIdx] || 0);
      }

      const audioTimestampMicros = Math.round((offset / sampleRate) * 1_000_000);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: 2,
        timestamp: audioTimestampMicros,
        data: planarData,
      });

      audioEncoder.encode(audioData);
      audioData.close();

      // Audio encoder backpressure
      if (audioEncoder.encodeQueueSize > 10) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    // 6. Setup offline canvas for rendering video frames
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      throw new Error('Canvas 2D contextの初期化に失敗しました。');
    }

    // 7. Video Frame-by-Frame Rendering Loop (non-rAF)
    onProgress({
      state: 'encoding',
      encodedFrames: 0,
      totalFrames,
      percent: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
    });

    const frameDurationMicros = Math.round(1_000_000 / fps);

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (isCancelled) {
        break;
      }

      if (encoderError) throw encoderError;
      const t = frameIdx / fps;
      const timestampMicros = Math.round(frameIdx * 1_000_000 / fps);

      // Render frame deterministically
      const videoFrames = await frames.prepare(project, t);
      if (isCancelled) break;
      render(ctx, project, t, { width, height }, videoFrames);

      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicros,
        duration: frameDurationMicros,
      });

      const isKeyFrame = frameIdx % 60 === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      // Report progress
      const now = performance.now();
      const elapsedMs = now - startTimeMs;
      const progressPercent = Math.round(((frameIdx + 1) / totalFrames) * 100);
      const framesPerMs = (frameIdx + 1) / (elapsedMs || 1);
      const remainingFrames = totalFrames - (frameIdx + 1);
      const estimatedRemainingMs = Math.round(remainingFrames / framesPerMs);

      onProgress({
        state: 'encoding',
        encodedFrames: frameIdx + 1,
        totalFrames,
        percent: progressPercent,
        elapsedMs,
        estimatedRemainingMs,
      });

      // Video encoder backpressure
      if (videoEncoder.encodeQueueSize > 5) {
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    if (isCancelled) {
      videoEncoder?.close();
      audioEncoder?.close();
      onProgress({
        state: 'cancelled',
        encodedFrames: 0,
        totalFrames,
        percent: 0,
        elapsedMs: 0,
        estimatedRemainingMs: 0,
      });
      throw new Error('エクスポートがキャンセルされました。');
    }

    // 8. Flush Encoders
    onProgress({
      state: 'muxing',
      encodedFrames: totalFrames,
      totalFrames,
      percent: 99,
      elapsedMs: performance.now() - startTimeMs,
      estimatedRemainingMs: 0,
    });

    await videoEncoder.flush();
    await audioEncoder.flush();

    videoEncoder.close();
    audioEncoder.close();

    // 9. Finalize MP4 Muxer
    muxer.finalize();

    const mp4Buffer = target.buffer;
    const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
    const safeSongName = (project.sections ? 'Kanaderu' : song?.name ?? 'movie').replace(/[/\\?%*:|"<>]/g, '_').trim() || 'movie';
    const filename = `${safeSongName}_${getFormattedDate()}.mp4`;
    const downloadUrl = URL.createObjectURL(blob);

    onProgress({
      state: 'completed',
      encodedFrames: totalFrames,
      totalFrames,
      percent: 100,
      elapsedMs: performance.now() - startTimeMs,
      estimatedRemainingMs: 0,
      blob,
      downloadUrl,
      filename,
    });

    return { blob, filename };
  })().catch((error: unknown) => {
    onProgress({ state: isCancelled ? 'cancelled' : 'error', encodedFrames: 0, totalFrames: 0,
      percent: 0, elapsedMs: 0, estimatedRemainingMs: 0, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }).finally(() => {
    frames.dispose();
    if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close();
    if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
  });

  return { promise, controller };
}
