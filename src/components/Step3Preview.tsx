import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Sparkles,
  Smartphone,
  Monitor,
  ArrowLeft,
  Volume2,
  Zap,
  Flame,
  SunMedium,
  Layers,
  Wand2,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type {
  AspectRatio,
  PresetType,
  ProjectConfig,
  TransitionStyle,
  VideoQuality,
} from '../types/project';
import { CompositionPlayer } from '../core/audio/composition';
import { VideoFrames } from '../core/video/media';
import { RESOLUTIONS_BY_QUALITY, render } from '../core/renderer/canvasRenderer';
import { PRESET_CONFIGS } from '../core/timeline/generator';

interface Step3PreviewProps {
  project: ProjectConfig;
  onPresetChange: (preset: PresetType) => void;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  onVideoQualityChange: (quality: VideoQuality) => void;
  onFadeChange: (opts: {
    fadeIn?: boolean;
    fadeInDuration?: number;
    fadeOut?: boolean;
    fadeOutDuration?: number;
  }) => void;
  onAspectChange: (aspect: AspectRatio) => void;
  onStartExport: () => void;
  onPrev: () => void;
  onError: (title: string, message: string, detail?: string) => void;
}

export const Step3Preview: React.FC<Step3PreviewProps> = ({
  project,
  onPresetChange,
  onTransitionStyleChange,
  onVideoQualityChange,
  onFadeChange,
  onAspectChange,
  onStartExport,
  onPrev,
  onError,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<CompositionPlayer | null>(null);

  const song = project.song;
  const timeline = project.timeline;
  const totalDuration = timeline ? timeline.totalDuration : 0;

  const framesRef = useRef<VideoFrames | null>(null);

  useEffect(() => {
    const player = new CompositionPlayer(project, setCurrentTime, () => {
      setIsPlaying(false); setCurrentTime(0);
    });
    playerRef.current = player;
    const frames = new VideoFrames();
    framesRef.current = frames;
    return () => {
      player.dispose(); frames.dispose();
      if (playerRef.current === player) playerRef.current = null;
      if (framesRef.current === frames) framesRef.current = null;
    };
  }, [project]);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // One decoder operation at a time; always draw against the current audio clock.
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let lastDrawTime = -1;
    const draw = async () => {
      const player = playerRef.current;
      const frames = framesRef.current;
      const canvas = canvasRef.current;
      if (disposed || !player || !frames || !canvas || !timeline) return;
      try {
        const time = Math.min(player.currentTime, Math.max(0, timeline.totalDuration - 0.001));
        if (!player.isPlaying) frames.pause();
        if (time === lastDrawTime || (player.isPlaying && Math.abs(time - lastDrawTime) < 1 / 30)) {
          frame = requestAnimationFrame(() => { void draw(); });
          return;
        }
        const sources = await frames.prepare(project, time, player.isPlaying);
        if (disposed) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const target = RESOLUTIONS_BY_QUALITY['1080p'][project.aspectRatio];
        if (canvas.width !== target.width || canvas.height !== target.height) { canvas.width = target.width; canvas.height = target.height; }
        render(ctx, project, time, target, sources);
        lastDrawTime = time;
        frame = requestAnimationFrame(() => { void draw(); });
      } catch (error) {
        if (!disposed) {
          player.pause(); frames.pause(); setIsPlaying(false);
          onError('動画の再生に失敗しました', String(error));
        }
      }
    };
    frame = requestAnimationFrame(() => { setIsPlaying(false); setCurrentTime(0); void draw(); });
    return () => { disposed = true; cancelAnimationFrame(frame); };
  }, [project, timeline, onError]);

  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await playerRef.current.play();
        setIsPlaying(true);
      } catch (err: unknown) {
        console.error('Audio playback failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        onError('音声の再生に失敗しました', msg);
      }
    }
  }, [isPlaying, onError]);

  const toggleFullscreen = useCallback(async () => {
    if (!videoContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  }, []);

  // Spacebar play/pause and F key fullscreen shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (playerRef.current) {
      playerRef.current.seek(target);
    }
  };

  const handleRestart = () => {
    setCurrentTime(0);
    if (playerRef.current) {
      playerRef.current.seek(0);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const presetOptions: { id: PresetType; label: string; sub: string; desc: string }[] = [
    {
      id: 'slow',
      label: 'ゆったり',
      sub: '穏やかなズーム・長めフェード',
      desc: 'バラードや風景写真に最適（フェード1.2秒）',
    },
    {
      id: 'standard',
      label: '標準',
      sub: '自然なリズム・標準フェード',
      desc: 'ポップスや日常スナップに最適（フェード0.8秒）',
    },
    {
      id: 'up',
      label: 'アップテンポ',
      sub: 'カット感強調・短めフェード',
      desc: 'ダンスやビートの効いた曲に最適（フェード0.4秒）',
    },
  ];

  const transitionStyleOptions: {
    id: TransitionStyle;
    label: string;
    badge: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'dynamic',
      label: 'メリハリ重視（おすすめ）',
      badge: '人気',
      desc: 'ビートフラッシュ・クラッシュズーム・スライドを曲の盛り上がりに合わせてミックス',
      icon: Zap,
    },
    {
      id: 'flash',
      label: 'ビートフラッシュ',
      badge: 'キレ',
      desc: 'ビートの切替点でインパクトのある白フラッシュ＋バウンス演出',
      icon: Flame,
    },
    {
      id: 'zoom',
      label: 'クラッシュズーム',
      badge: 'ダイナミック',
      desc: '写真が吸い込まれるような急加速ズームイン＆ズームアウト切替',
      icon: Sparkles,
    },
    {
      id: 'cinematic',
      label: 'シネマティック（光フレア＆暗転）',
      badge: '映画調',
      desc: '温かい光のフレア（ライトリーク）とドラマチックな暗転切替',
      icon: SunMedium,
    },
    {
      id: 'auto',
      label: '曲調おまかせ',
      badge: '自動',
      desc: '選択された雰囲気プリセットと楽曲エネルギーに応じた自動バランス',
      icon: Wand2,
    },
    {
      id: 'crossfade',
      label: 'クラシッククロスフェード',
      badge: 'シンプル',
      desc: '写真同士が滑らかに溶け合う王道のディゾルブ演出',
      icon: Layers,
    },
  ];

  const videoQualityOptions: { id: VideoQuality; label: string; resolution: string; bitrate: string; badge: string }[] = [
    {
      id: '1080p',
      label: 'FHD 1080p',
      resolution: project.aspectRatio === '16:9' ? '1920×1080' : '1080×1920',
      bitrate: '~12 Mbps',
      badge: '標準・推奨',
    },
    {
      id: '4k',
      label: '4K 2160p',
      resolution: project.aspectRatio === '16:9' ? '3840×2160' : '2160×3840',
      bitrate: '~28 Mbps',
      badge: '最高画質',
    },
    {
      id: '720p',
      label: 'HD 720p',
      resolution: project.aspectRatio === '16:9' ? '1280×720' : '720×1280',
      bitrate: '~6 Mbps',
      badge: '軽量・高速',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {/* Header & Aspect Switch */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
            ステップ 3：プレビューと書き出し
          </h2>
          <p className="text-[#58534E] text-sm mt-1.5">
            {project.musicMode === 'continuous' ? '1曲を全セクションで通して再生します。セクションの境目で楽曲が途切れることはありません。' : 'すべてのセクションを順番に再生します。各楽曲の使用範囲とフェード、動画の元音声も確認できます。'}
          </p>
        </div>

        {/* Aspect Ratio Switch */}
        <div className="flex items-center bg-[#F4F1EA] p-1 rounded-2xl border border-[#E5E1D6] text-xs font-semibold">
          <button
            onClick={() => onAspectChange('16:9')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              project.aspectRatio === '16:9'
                ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                : 'text-[#58534E] hover:text-[#1C1917]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9 横向き (YouTube等)</span>
          </button>
          <button
            onClick={() => onAspectChange('9:16')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              project.aspectRatio === '9:16'
                ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                : 'text-[#58534E] hover:text-[#1C1917]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 縦向き (LINE/Reels等)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" aria-label="セクションへ移動">
        {project.sectionRanges?.map(range => <button key={range.id} onClick={() => { setCurrentTime(range.startTime); playerRef.current?.seek(range.startTime); }} className="px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white">{range.name} · {formatTime(range.startTime)}</button>)}
      </div>
      {!!timeline?.messages.length && <div role="alert" className="mb-5 p-4 bg-red-50 rounded-xl text-sm text-red-800">{timeline.messages.map((message, i) => <p key={i}>{message.title}：{message.text}</p>)}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Video Preview Canvas Area */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Canvas Container with Fullscreen Support */}
          <div
            ref={videoContainerRef}
            className={`relative bg-[#09090B] overflow-hidden flex items-center justify-center transition-all ${
              isFullscreen
                ? 'fixed inset-0 z-50 w-screen h-screen rounded-none bg-black'
                : `rounded-3xl shadow-md border border-[#27272A] ${
                    project.aspectRatio === '16:9'
                      ? 'w-full aspect-16/9'
                      : 'w-[320px] sm:w-[360px] aspect-9/16 max-h-[560px]'
                  }`
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
            />

            {/* Big Play Overlay when paused */}
            {!isPlaying && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 bg-black/35 flex items-center justify-center cursor-pointer transition-opacity"
              >
                <div className="w-16 h-16 rounded-full bg-white/95 backdrop-blur-md text-[#1C1917] flex items-center justify-center shadow-lg pl-1 hover:scale-105 transition-transform">
                  <Play className="w-7 h-7 fill-current" />
                </div>
              </div>
            )}

            {/* Vibe overlay badge (top-left) */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 border border-white/10 select-none">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{PRESET_CONFIGS[project.preset] ? presetOptions.find(p => p.id === project.preset)?.label : '演出'}</span>
              <span className="opacity-40">•</span>
              <span className="text-amber-300">
                {transitionStyleOptions.find(t => t.id === project.transitionStyle)?.label || '演出'}
              </span>
            </div>

            {/* Fullscreen Button Overlay (top-right) */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'フルスクリーン解除 (Esc / F)' : 'フルスクリーンで確認 (Fキー)'}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition-colors shadow-xs"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen floating bottom bar */}
            {isFullscreen && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-black/75 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white font-bold w-12">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={totalDuration}
                    step={0.05}
                    value={currentTime}
                    onChange={handleSeekChange}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
                  />
                  <span className="text-xs font-mono text-white/60 w-12 text-right">
                    {formatTime(totalDuration)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={togglePlay}
                    className="px-3 py-1.5 bg-white text-[#1C1917] rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlaying ? '一時停止' : '再生'}</span>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="text-xs text-white/80 hover:text-white px-2 py-1"
                  >
                    全画面解除 (Esc)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Player Controller Bar (Regular view) */}
          <div className="w-full bg-[#FFFFFF] rounded-2xl border border-[#E5E1D6] p-4 shadow-xs mt-4">
            {/* Seekbar */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-mono font-bold text-[#1C1917] w-14">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.05}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full accent-[#1C1917] cursor-pointer h-2 bg-[#F4F1EA] rounded-lg"
              />

              <span className="text-xs font-mono text-[#8E8880] w-14 text-right">
                {formatTime(totalDuration)}
              </span>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                      <span>一時停止 (Space)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>再生 (Space)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  title="最初から再生"
                  className="p-2 text-[#58534E] hover:text-[#1C1917] hover:bg-[#F4F1EA] rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={toggleFullscreen}
                  title="フルスクリーンで確認 (Fキー)"
                  className="flex items-center gap-1.5 px-3 py-2 border border-[#E5E1D6] hover:bg-[#F4F1EA] text-xs font-semibold text-[#58534E] hover:text-[#1C1917] rounded-xl transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">全画面 (F)</span>
                </button>
              </div>

              <div className="text-xs font-mono text-[#8E8880] flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[#58534E]" />
                <span>{project.sectionRanges?.find(range => currentTime >= range.startTime && currentTime < range.startTime + range.duration)?.name ?? song?.name}</span>
                <span>• 素材 {project.photos.length} 点</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Settings & Export CTA Panel */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Fade Settings Card */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[#E5E1D6] p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-[#1C1917]" />
              <h3 className="font-bold text-[#1C1917] text-sm">楽曲・映像のフェード設定</h3>
            </div>
            <p className="text-xs text-[#58534E] mb-3.5">
              動画の最初と最後の自然なフェードイン・フェードアウトを設定できます。
            </p>

            <div className="flex flex-col gap-3">
              {/* Head Fade-in */}
              <div className="p-3 bg-[#FAF9F5] rounded-2xl border border-[#E5E1D6]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#1C1917]">曲頭のフェードイン</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.fadeIn}
                      onChange={(e) => onFadeChange({ fadeIn: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-[#CDC7B8] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#1C1917]"></div>
                  </label>
                </div>

                {project.fadeIn && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {[0.5, 1.0, 1.5, 2.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onFadeChange({ fadeInDuration: sec })}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                          project.fadeInDuration === sec
                            ? 'bg-[#1C1917] text-white shadow-xs'
                            : 'bg-[#FFFFFF] text-[#58534E] hover:bg-[#F4F1EA] border border-[#E5E1D6]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tail Fade-out */}
              <div className="p-3 bg-[#FAF9F5] rounded-2xl border border-[#E5E1D6]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold text-[#1C1917]">曲末のフェードアウト</span>
                    <span className="text-[10px] text-[#8E8880] block">（音声＆映像を黒へフェード）</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={project.fadeOut}
                      onChange={(e) => onFadeChange({ fadeOut: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-[#CDC7B8] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#1C1917]"></div>
                  </label>
                </div>

                {project.fadeOut && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1.0, 2.0, 3.0, 4.0].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onFadeChange({ fadeOutDuration: sec })}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                          project.fadeOutDuration === sec
                            ? 'bg-[#1C1917] text-white shadow-xs'
                            : 'bg-[#FFFFFF] text-[#58534E] hover:bg-[#F4F1EA] border border-[#E5E1D6]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transition Style Selector */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[#E5E1D6] p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-[#1C1917] text-sm">トランジション（切り替え効果）</h3>
            </div>
            <p className="text-xs text-[#58534E] mb-3">
              写真の切り替え演出をワンクリックで変更できます。
            </p>

            <div className="flex flex-col gap-1.5">
              {transitionStyleOptions.map((opt) => {
                const isSelected = (project.transitionStyle || 'dynamic') === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onTransitionStyleChange(opt.id)}
                    className={`text-left p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600 shadow-xs'
                        : 'border-[#E5E1D6] hover:border-[#CDC7B8] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#F4F1EA] text-[#58534E]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-[#1C1917]">{opt.label}</span>
                      </div>
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-600 text-white'
                            : 'bg-[#F4F1EA] text-[#8E8880]'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#58534E] mt-1 pl-8 leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Selector */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[#E5E1D6] p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#1C1917]" />
              <h3 className="font-bold text-[#1C1917] text-sm">雰囲気プリセット</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              {presetOptions.map((opt) => {
                const isSelected = project.preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onPresetChange(opt.id)}
                    className={`text-left p-2.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-[#1C1917] bg-[#1C1917] text-white shadow-xs'
                        : 'border-[#E5E1D6] hover:border-[#CDC7B8] hover:bg-[#FAF9F5] text-[#1C1917]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{opt.label}</span>
                      {isSelected && (
                        <span className="text-[9px] uppercase font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                          選択中
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#8E8880]'}`}>{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Primary Action Card with Quality Selector */}
          <div className="bg-[#1C1917] rounded-3xl p-6 text-white shadow-md border border-[#27272A]">
            <div className="flex items-center gap-2 mb-1.5">
              <Film className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-base tracking-tight">MP4ムービー書き出し</h3>
            </div>
            <p className="text-xs text-[#CDC7B8] mb-4 leading-relaxed">
              H.264＋AAC形式で高速エンコードし、高画質動画を作成します。
            </p>

            {/* Quality Selector */}
            <div className="mb-4 bg-[#27272A] p-2.5 rounded-2xl border border-white/10">
              <span className="text-[11px] text-[#A1A1AA] font-bold block mb-2">
                出力画質 / 解像度設定
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {videoQualityOptions.map((opt) => {
                  const isSelected = (project.videoQuality || '1080p') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onVideoQualityChange(opt.id)}
                      className={`p-2 rounded-xl text-center transition-all ${
                        isSelected
                          ? 'bg-amber-600 text-white font-bold shadow-xs'
                          : 'bg-white/5 hover:bg-white/10 text-[#D4D4D8]'
                      }`}
                    >
                      <div className="text-xs">{opt.label}</div>
                      <div className="text-[9px] font-mono opacity-80 mt-0.5">{opt.resolution}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {project.timeline?.hasInsufficientTime ? (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-200 leading-relaxed">
                ⚠️ 写真の表示に必要な秒数が不足しています。ステップ2で写真の枚数または固定秒数を調整してください。
              </div>
            ) : project.timeline?.isExceeded ? (
              <div className="mb-4 p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-xs text-amber-200 leading-relaxed">
                ⚠️ 写真の枚数が多すぎるか固定秒数が曲の長さを超えているため書き出しできません。ステップ2で調整してください。
              </div>
            ) : null}

            <button
              onClick={() => {
                if (playerRef.current) playerRef.current.pause();
                framesRef.current?.pause();
                setIsPlaying(false);
                onStartExport();
              }}
              disabled={
                !project.timeline ||
                project.timeline.isExceeded ||
                project.timeline.hasInsufficientTime
              }
              className="w-full py-3.5 px-6 rounded-2xl bg-white text-[#1C1917] font-bold text-sm shadow-sm hover:bg-[#F4F1EA] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Film className="w-4 h-4 text-amber-600" />
              <span>MP4を書き出す</span>
            </button>

            <p className="text-[11px] font-mono text-[#8E8880] text-center mt-3">
              完全クライアント内処理 • サーバー送信なし
            </p>
          </div>

          {/* Back Navigation */}
          <button
            onClick={() => {
              if (playerRef.current) playerRef.current.pause();
              setIsPlaying(false);
              onPrev();
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border border-[#E5E1D6] text-xs font-semibold text-[#58534E] hover:text-[#1C1917] hover:bg-[#F4F1EA] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>写真の変更（ステップ2へ戻る）</span>
          </button>
        </div>
      </div>
    </div>
  );
};
