import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Music,
  Disc,
  Zap,
  Clock,
  ArrowRight,
  Play,
  Pause,
  Scissors,
  RotateCcw,
  FastForward,
  Rewind,
} from 'lucide-react';
import type { SongData } from '../types/project';
import { clampAudioTrim } from '../core/audio/trim';
import { analyzeAudioFile } from '../core/audio/analyzer';
import { AudioPreviewPlayer } from '../core/audio/player';

interface Step1MusicProps {
  title?: string;
  onMediaTask?: (delta: number) => void;
  allowNoMusic?: boolean;
  nextLabel?: string;
  durationNotice?: string;
  song: SongData | null;
  onSongLoaded: (song: SongData) => void;
  onNext: () => void;
  onError: (title: string, message: string, detail?: string) => void;
}

export const Step1Music: React.FC<Step1MusicProps> = ({
  title = 'ステップ 1：このセクションの音楽',
  onMediaTask,
  allowNoMusic = true,
  nextLabel = '写真を選ぶ（ステップ2へ）',
  durationNotice,
  song,
  onSongLoaded,
  onNext,
  onError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Audition playback with precise time tracking
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [currentAuditionTime, setCurrentAuditionTime] = useState(0); // seconds relative to trimStart
  const playerRef = useRef<AudioPreviewPlayer | null>(null);

  const trimStart = song?.trimStart ?? 0;
  const trimEnd = song?.trimEnd ?? (song?.duration ?? 0);
  const trimDuration = Math.max(0.1, trimEnd - trimStart);
  const currentAbsoluteSongTime = trimStart + currentAuditionTime;

  // Initialize and update AudioPreviewPlayer
  useEffect(() => {
    if (!song) return;

    const player = new AudioPreviewPlayer(
      (time) => {
        setCurrentAuditionTime(time);
      },
      () => {
        setIsPlayingAudition(false);
        setCurrentAuditionTime(0);
      }
    );

    player.setAudioBuffer(song.audioBuffer, trimStart, trimEnd, 0, 0);
    playerRef.current = player;
    const reset = requestAnimationFrame(() => { setIsPlayingAudition(false); setCurrentAuditionTime(0); });

    return () => {
      cancelAnimationFrame(reset);
      player.dispose();
      playerRef.current = null;
    };
  }, [song, trimStart, trimEnd]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];

    const validExtensions = /\.(mp3|m4a|wav|aac|ogg)$/i;
    if (!validExtensions.test(file.name) && !file.type.startsWith('audio/')) {
      onError('非対応ファイル形式', 'mp3, m4a, wav 等の音声ファイルを選択してください。');
      return;
    }

    setIsAnalyzing(true); onMediaTask?.(1);
    try {
      const analyzedSong = await analyzeAudioFile(file, (step) => {
        setAnalyzeStep(step);
      });
      onSongLoaded(analyzedSong);
    } catch (err: unknown) {
      console.error('Audio analysis failed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      onError('音楽の読み込み・解析に失敗しました', errorMsg);
    } finally {
      setIsAnalyzing(false); onMediaTask?.(-1);
      setAnalyzeStep('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPreciseSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const stopAudition = () => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    setIsPlayingAudition(false);
    setCurrentAuditionTime(0);
  };

  const toggleAudition = async () => {
    if (!playerRef.current || !song) return;

    if (isPlayingAudition) {
      playerRef.current.pause();
      setIsPlayingAudition(false);
    } else {
      try {
        await playerRef.current.play();
        setIsPlayingAudition(true);
      } catch (e) {
        console.error('Audition playback failed:', e);
        setIsPlayingAudition(false);
      }
    }
  };

  const handleSeek = (newRelativeTime: number) => {
    const clamped = Math.max(0, Math.min(newRelativeTime, trimDuration));
    setCurrentAuditionTime(clamped);
    if (playerRef.current) {
      playerRef.current.seek(clamped);
    }
  };

  const handleSkip = (deltaSeconds: number) => {
    handleSeek(currentAuditionTime + deltaSeconds);
  };

  const handleRestartAudition = () => {
    handleSeek(0);
    if (!isPlayingAudition && playerRef.current) {
      playerRef.current.play();
      setIsPlayingAudition(true);
    }
  };

  // Click on waveform to jump playhead or adjust trim
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!song || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSongTime = ratio * song.duration;

    if (targetSongTime >= trimStart && targetSongTime <= trimEnd) {
      // Seek within trim
      handleSeek(targetSongTime - trimStart);
    } else if (targetSongTime < trimStart) {
      // If clicked before trim start, seek to start of trim
      handleSeek(0);
    } else {
      // If clicked after trim end, seek to end
      handleSeek(trimDuration);
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    if (!song) return;
    stopAudition();
    const { trimStart: clampedStart, trimEnd: clampedEnd } = clampAudioTrim(song.duration, start, end);

    onSongLoaded({
      ...song,
      trimStart: clampedStart,
      trimEnd: clampedEnd,
    });
  };

  const presetLabels = {
    slow: { title: 'ゆったり', badge: 'bg-[#F4F1EA] text-[#58534E] border-[#E5E1D6]' },
    standard: { title: 'スタンダード', badge: 'bg-[#F4F1EA] text-[#1C1917] border-[#E5E1D6]' },
    up: { title: 'アップテンポ', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
  };

  // Playhead position percentage over entire song waveform
  const playheadPercent = song
    ? (currentAbsoluteSongTime / song.duration) * 100
    : 0;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
          {title}
        </h2>
        <p className="text-[#58534E] mt-1.5 text-sm">
          BGMとなる音楽ファイル（MP3 / M4A / WAV）を読み込みます。波形をクリックして再生位置を確認・調整できます。
        </p>
      </div>

      {durationNotice && <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50">
        <p className="text-sm text-stone-700">{durationNotice}</p>
        <p role="status" className="font-bold mt-2">{song ? `動画全体の尺：${trimDuration.toFixed(2)}秒（${formatPreciseSeconds(trimStart)} 〜 ${formatPreciseSeconds(trimEnd)}）` : '全体の尺：音楽の選択後に確定します'}</p>
      </div>}
      {/* Upload Drop Zone */}
      {!song ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-amber-500 bg-amber-50/30'
              : 'border-[#CDC7B8] hover:border-[#1C1917] bg-[#FFFFFF] shadow-xs hover:shadow-sm'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/*,.mp3,.m4a,.wav"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center border border-[#E5E1D6]">
              {isAnalyzing ? (
                <Disc className="w-6 h-6 animate-spin text-amber-600" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            {isAnalyzing ? (
              <div>
                <p className="font-bold text-[#1C1917] text-base">楽曲を解析中...</p>
                <p className="text-xs text-amber-700 font-mono mt-1">{analyzeStep}</p>
                <p className="text-[11px] text-[#8E8880] mt-2">ブラウザ内で安全に解析しています（外部送信なし）</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-[#1C1917] text-base sm:text-lg">
                  音楽ファイルをここにドラッグ＆ドロップ
                </p>
                <p className="text-xs text-[#58534E] mt-1">または クリックしてファイルを選択</p>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#8E8880]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">MP3</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">M4A / AAC</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F1EA] font-mono border border-[#E5E1D6]">WAV</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Song Analysis Card & Trimming / Preview */
        <div className="bg-[#FFFFFF] rounded-3xl border border-[#E5E1D6] shadow-xs p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E1D6]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917] text-white flex items-center justify-center shrink-0">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#1C1917] text-base sm:text-lg truncate max-w-md">{song.name}</h3>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${presetLabels[song.detectedPreset].badge}`}>
                    {presetLabels[song.detectedPreset].title}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#8E8880] mt-0.5">
                  {(song.file.size / (1024 * 1024)).toFixed(1)} MB • {song.audioBuffer.numberOfChannels}ch • {song.audioBuffer.sampleRate}Hz
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#58534E] hover:text-[#1C1917] font-semibold px-3 py-1.5 rounded-xl border border-[#E5E1D6] hover:bg-[#F4F1EA] transition-colors"
            >
              曲を変更
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              accept="audio/*,.mp3,.m4a,.wav"
              className="hidden"
            />
          </div>

          {/* Analysis Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>総時間</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {formatSeconds(song.duration)}
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Disc className="w-3.5 h-3.5" />
                <span>テンポ (BPM)</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {song.bpm} <span className="text-xs font-normal text-[#8E8880]">BPM</span>
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Zap className="w-3.5 h-3.5" />
                <span>エネルギー (RMS)</span>
              </div>
              <p className="text-lg font-bold text-[#1C1917] mt-1 font-mono">
                {(song.rms * 100).toFixed(0)}<span className="text-xs font-normal text-[#8E8880]">%</span>
              </p>
            </div>

            <div className="bg-[#FAF9F5] rounded-2xl p-4 border border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 text-xs text-[#8E8880] font-medium">
                <Scissors className="w-3.5 h-3.5" />
                <span>使用区間</span>
              </div>
              <p className="text-lg font-bold text-amber-600 mt-1 font-mono">
                {formatSeconds(trimDuration)}
              </p>
            </div>
          </div>

          {/* Interactive Music Audition & Trimming Studio */}
          <div className="bg-[#FAF9F5] rounded-2xl p-5 border border-[#E5E1D6] mb-6">
            {/* Header with Title & Live Time Counter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#1C1917]" />
                <span className="font-bold text-xs text-[#1C1917]">曲のトリミングと再生プレビュー</span>
              </div>

              {/* Real-time Playback Time Display */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#1C1917] bg-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[#E5E1D6]">
                  {formatPreciseSeconds(currentAuditionTime)} / {formatPreciseSeconds(trimDuration)}
                </span>
                <span className="text-[11px] text-[#8E8880] hidden sm:inline">
                  (曲全体: {formatSeconds(currentAbsoluteSongTime)} / {formatSeconds(song.duration)})
                </span>
              </div>
            </div>

            {/* Interactive Waveform / RMS Visual Bar with Playhead */}
            <div
              ref={waveformRef}
              onClick={handleWaveformClick}
              title="波形をクリックして再生位置を変更できます"
              className="h-16 bg-[#FFFFFF] rounded-xl border border-[#E5E1D6] overflow-hidden flex items-end px-2 py-1 gap-0.5 relative cursor-pointer group select-none shadow-inner"
            >
              {/* RMS Waveform Bars */}
              {song.energyCurve.slice(0, 100).map((pt, idx) => {
                const isInsideTrim = pt.time >= trimStart && pt.time <= trimEnd;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-t-xs transition-colors ${
                      isInsideTrim
                        ? 'bg-[#1C1917] group-hover:bg-[#292524]'
                        : 'bg-[#E5E1D6] group-hover:bg-[#CDC7B8]'
                    }`}
                    style={{ height: `${Math.max(10, Math.min(100, pt.energy * 250))}%` }}
                  />
                );
              })}

              {/* Trim Range Highlight Mask */}
              <div
                className="absolute inset-y-0 border-x-2 border-amber-600 bg-amber-500/10 pointer-events-none transition-all"
                style={{
                  left: `${(trimStart / song.duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / song.duration) * 100}%`,
                }}
              />

              {/* Moving Playhead Marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none z-10 shadow-md transition-all duration-75"
                style={{ left: `${Math.max(0, Math.min(100, playheadPercent))}%` }}
              >
                <div className="absolute top-0 -left-1.5 w-3.5 h-3.5 bg-amber-600 text-white rounded-full flex items-center justify-center shadow-xs">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </div>
            </div>

            {/* Playback Scrubbing Seekbar */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] font-mono text-[#8E8880] w-12">
                {formatSeconds(currentAuditionTime)}
              </span>

              <input
                type="range"
                min={0}
                max={trimDuration}
                step={0.1}
                value={currentAuditionTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-[#E5E1D6] rounded-lg"
              />

              <span className="text-[11px] font-mono text-[#8E8880] w-12 text-right">
                {formatSeconds(trimDuration)}
              </span>
            </div>

            {/* Playback Buttons & Quick Skips */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-[#E5E1D6]">
              <div className="flex items-center gap-1.5">
                {/* Main Play / Pause */}
                <button
                  onClick={toggleAudition}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1C1917] hover:bg-[#292524] px-4 py-2 rounded-xl shadow-xs transition-colors"
                >
                  {isPlayingAudition ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                      <span>一時停止</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-white" />
                      <span>試聴再生</span>
                    </>
                  )}
                </button>

                {/* Restart from beginning of trim */}
                <button
                  onClick={handleRestartAudition}
                  title="区間の先頭から再生"
                  className="flex items-center gap-1 text-xs font-semibold text-[#58534E] hover:text-[#1C1917] bg-[#FFFFFF] border border-[#E5E1D6] px-2.5 py-2 rounded-xl hover:bg-[#F4F1EA] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">最初から</span>
                </button>

                {/* -5s / +5s Quick Jumps */}
                <button
                  onClick={() => handleSkip(-5)}
                  title="5秒戻る"
                  className="flex items-center gap-1 text-xs font-semibold text-[#58534E] hover:text-[#1C1917] bg-[#FFFFFF] border border-[#E5E1D6] px-2.5 py-2 rounded-xl hover:bg-[#F4F1EA] transition-colors"
                >
                  <Rewind className="w-3.5 h-3.5" />
                  <span>-5s</span>
                </button>

                <button
                  onClick={() => handleSkip(5)}
                  title="5秒進む"
                  className="flex items-center gap-1 text-xs font-semibold text-[#58534E] hover:text-[#1C1917] bg-[#FFFFFF] border border-[#E5E1D6] px-2.5 py-2 rounded-xl hover:bg-[#F4F1EA] transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>+5s</span>
                </button>
              </div>

              <span className="text-[11px] text-[#8E8880]">
                波形をクリックまたはスライダーで自由にシークできます
              </span>
            </div>

            {/* Trim Sliders (Start & End Range) */}
            <div className="mt-4 pt-3 border-t border-[#E5E1D6]/70">
              <div className="text-[11px] font-bold text-[#58534E] mb-2">使用区間のトリミング調整:</div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-1 w-full flex items-center gap-2 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#E5E1D6]">
                  <span className="text-xs text-[#8E8880] font-mono">開始位置:</span>
                  <input
                    type="range"
                    min={0}
                    aria-label="楽曲の開始位置"
                    max={Math.max(0, song.duration - Math.min(1, song.duration))}
                    step={0.5}
                    value={song.trimStart}
                    onChange={(e) => handleTrimChange(parseFloat(e.target.value), song.trimEnd)}
                    className="w-full accent-[#1C1917] cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-[#1C1917] w-12 text-right">
                    {formatSeconds(song.trimStart)}
                  </span>
                </div>

                <div className="flex-1 w-full flex items-center gap-2 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#E5E1D6]">
                  <span className="text-xs text-[#8E8880] font-mono">終了位置:</span>
                  <input
                    type="range"
                    aria-label="楽曲の終了位置"
                    min={song.trimStart + Math.min(1, song.duration)}
                    max={song.duration}
                    step={0.5}
                    value={song.trimEnd}
                    onChange={(e) => handleTrimChange(song.trimStart, parseFloat(e.target.value))}
                    className="w-full accent-[#1C1917] cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-[#1C1917] w-12 text-right">
                    {formatSeconds(song.trimEnd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                stopAudition();
                onNext();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-[#1C1917] hover:bg-[#292524] text-white font-semibold text-sm rounded-2xl shadow-xs transition-all"
            >
              <span>{nextLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {!song && allowNoMusic && <button onClick={onNext} className="mt-6 px-5 py-3 border border-stone-300 rounded-xl text-sm font-semibold">BGMなしで写真・動画を配置する →</button>}
    </div>
  );
};
