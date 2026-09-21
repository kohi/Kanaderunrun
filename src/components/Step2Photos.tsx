import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  Pin,
  X,
  Info,
  Check,
  Wand2,
  Shuffle,
  ArrowUpDown,
  Sparkles,
  RotateCcw,
  RefreshCw,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import type {
  CoverImageItem,
  CoverSettings,
  PhotoItem,
  TimingSong,
  SongFlowPattern,
  Timeline,
  TransitionType,
} from '../types/project';
import { autoEffects, MEDIA_DRAG_TYPE, moveMedia, replaceMedia } from '../core/utils/mediaEdits';
import type { PhotoUpdate } from '../core/utils/mediaEdits';
import { loadVideo } from '../core/video/media';
import { VideoClipEditor } from './VideoClipEditor';
import { loadAndProcessImage } from '../core/utils/imageLoader';
import {
  SONG_FLOW_PATTERNS,
  orderPhotosBySongFlow,
  shufflePhotos,
  sortPhotosByName,
} from '../core/utils/photoAnalyzer';

interface Step2PhotosProps {
  sectionId: string;
  onMediaTask: (delta: number) => void;
  onEffectsApplied: () => void;
  song: TimingSong;
  photos: PhotoItem[];
  coverSettings: CoverSettings;
  timeline: Timeline | null;
  onPhotosChange: (photos: PhotoUpdate) => void;
  onCoverSettingsChange: (settings: CoverSettings) => void;
  onPrev: () => void;
  onNext: () => void;
  onNotify?: (type: 'success' | 'info', title: string, message?: string) => void;
  onError: (title: string, message: string, detail?: string) => void;
}

const TRANSITION_OPTIONS: { id: TransitionType; label: string; icon: string; desc: string }[] = [
  { id: 'flash', label: 'フラッシュ', icon: '⚡', desc: 'ビート白フラッシュ' },
  { id: 'zoom', label: 'ズーム', icon: '💥', desc: '高速クラッシュズーム' },
  { id: 'light-leak', label: '光フレア', icon: '☀️', desc: 'シネマティックな光漏れ' },
  { id: 'slide', label: 'スライド', icon: '➡️', desc: 'スムーズな横移動' },
  { id: 'dip-black', label: '暗転', icon: '🌑', desc: 'ドラマチックな黒フェード' },
  { id: 'crossfade', label: 'クロスフェード', icon: '🌊', desc: '滑らかな溶け込み' },
];

export const Step2Photos: React.FC<Step2PhotosProps> = ({
  sectionId,
  onMediaTask,
  onEffectsApplied,
  song,
  photos,
  coverSettings,
  timeline,
  onPhotosChange,
  onCoverSettingsChange,
  onPrev,
  onNext,
  onNotify,
  onError,
}) => {
  const busy = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const titleCoverInputRef = useRef<HTMLInputElement>(null);
  const endingCoverInputRef = useRef<HTMLInputElement>(null);

  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isCoverSectionOpen, setIsCoverSectionOpen] = useState(false);

  // Duration & Transition editor modal state
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [customDurationInput, setCustomDurationInput] = useState<string>('');
  const [selectedTransition, setSelectedTransition] = useState<TransitionType | undefined>(undefined);

  // Song flow arrangement pattern state
  const [selectedPattern, setSelectedPattern] = useState<SongFlowPattern>('narrative');
  const [isPatternMenuOpen, setIsPatternMenuOpen] = useState(false);
  const patternMenuRef = useRef<HTMLDivElement>(null);

  // Close pattern menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patternMenuRef.current && !patternMenuRef.current.contains(e.target as Node)) {
        setIsPatternMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const movieDuration = Math.max(0.1, (song.trimEnd || song.duration) - (song.trimStart || 0));
  const stillPhotos = photos.filter(photo => !photo.video);
  const videoCount = photos.length - stillPhotos.length;
  const automaticPhotoCount = stillPhotos.filter(photo => !photo.lockedDuration).length;
  const reservedTime = photos.reduce((sum, photo) => sum + (photo.video ? photo.video.trimEnd - photo.video.trimStart : photo.lockedDuration ?? 0), 0)
    + Object.values(coverSettings).reduce((sum, cover) => sum + (cover.enabled && cover.photo ? cover.duration : 0), 0);
  const availablePhotoTime = Math.max(0, movieDuration - reservedTime);
  const maxPhotosAllowed = stillPhotos.length - automaticPhotoCount + Math.floor((availablePhotoTime + 0.000001) / 1.5);
  const isBlocked = timeline ? (timeline.hasInsufficientTime || (timeline.isExceeded && timeline.segments.length === 0)) : false;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length || busy.current) return;
    busy.current = true;

    setIsLoading(true); onMediaTask(1);
    const newItems: PhotoItem[] = [];
    const files = Array.from(fileList);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadingText(`素材処理中 (${i + 1}/${files.length}): ${file.name}`);

      try {
        const item = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name) ? await loadVideo(file) : await loadAndProcessImage(file);
        newItems.push(item);
      } catch (err: unknown) {
        console.error('Image loading failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        onError('写真の読み込みに失敗しました', msg);
      }
    }

    setIsLoading(false); onMediaTask(-1);
    setLoadingText('');
    busy.current = false;

    if (newItems.length > 0) {
      onPhotosChange(current => [...current, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) return;
    handleFiles(e.dataTransfer.files);
  };

  // Cover image handlers
  const handleTitleCoverUpload = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setIsLoading(true); onMediaTask(1);
    setLoadingText(`オープニング表紙を処理中: ${file.name}`);
    try {
      const item = await loadAndProcessImage(file);
      const coverItem: CoverImageItem = {
        id: item.id,
        file: item.file,
        name: item.name,
        originalWidth: item.originalWidth,
        originalHeight: item.originalHeight,
        previewUrl: item.previewUrl,
        bitmap: item.bitmap,
      };
      onCoverSettingsChange({
        ...coverSettings,
        titleCover: {
          ...coverSettings.titleCover,
          enabled: true,
          photo: coverItem,
        },
      });
      if (onNotify) {
        onNotify('success', 'オープニング表紙を設定しました');
      }
    } catch (err: unknown) {
      onError('オープニング表紙の読み込みに失敗しました', String(err));
    } finally {
      setIsLoading(false); onMediaTask(-1);
      setLoadingText('');
    }
  };

  const handleEndingCoverUpload = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setIsLoading(true); onMediaTask(1);
    setLoadingText(`エンディング表紙を処理中: ${file.name}`);
    try {
      const item = await loadAndProcessImage(file);
      const coverItem: CoverImageItem = {
        id: item.id,
        file: item.file,
        name: item.name,
        originalWidth: item.originalWidth,
        originalHeight: item.originalHeight,
        previewUrl: item.previewUrl,
        bitmap: item.bitmap,
      };
      onCoverSettingsChange({
        ...coverSettings,
        endingCover: {
          ...coverSettings.endingCover,
          enabled: true,
          photo: coverItem,
        },
      });
      if (onNotify) {
        onNotify('success', 'エンディング表紙を設定しました');
      }
    } catch (err: unknown) {
      onError('エンディング表紙の読み込みに失敗しました', String(err));
    } finally {
      setIsLoading(false); onMediaTask(-1);
      setLoadingText('');
    }
  };

  // Replace single photo handler
  const handleTriggerReplacePhoto = (index: number) => {
    setReplacingIndex(index);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const replacePhotoFile = async (file: File, target: PhotoItem) => {
    if (busy.current) return;
    if (target.video) { onError('写真にドロップしてください', '動画の差し替えは削除・追加で行ってください。'); return; }
    busy.current = true;
    setIsLoading(true); onMediaTask(1); setLoadingText(`写真を差し替え中: ${file.name}`);
    try {
      const item = await loadAndProcessImage(file);
      onPhotosChange(current => replaceMedia(current, target.id, item));
      onNotify?.('success', '写真を差し替えました', '順番・固定秒数・演出を維持しています。');
    } catch (error) { onError('写真の差し替えに失敗しました', String(error)); }
    finally { busy.current = false; setIsLoading(false); onMediaTask(-1); setLoadingText(''); setReplacingIndex(null); }
  };
  const handleReplaceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = replacingIndex === null ? null : photos[replacingIndex];
    if (file && target) void replacePhotoFile(file, target);
    event.target.value = '';
  };

  const handleDeletePhoto = (index: number) => {
    const updated = photos.filter((_, idx) => idx !== index);
    onPhotosChange(updated);
    if (editingPhotoIndex === index) {
      setEditingPhotoIndex(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('すべての写真を削除しますか？')) {
      onPhotosChange([]);
      setEditingPhotoIndex(null);
    }
  };

  // Reordering, Dynamic Durations & Transitions with Patterns
  const handleApplyPattern = (pattern: SongFlowPattern) => {
    if (photos.some(photo => photo.video)) { onNotify?.('info', '動画を含むセクションは手動で並べ替えてください', '動画の使用範囲と順番を保つため、おまかせ配分は写真のみのセクションで使用できます。'); return; }
    if (photos.length <= 1) return;
    setSelectedPattern(pattern);
    setIsPatternMenuOpen(false);
    const reordered = orderPhotosBySongFlow(photos, song, true, true, coverSettings, pattern);
    onPhotosChange(reordered);
    const opt = SONG_FLOW_PATTERNS.find((p) => p.id === pattern);
    if (onNotify) {
      onNotify(
        'success',
        `「${opt?.shortName || '曲の流れに合わせる'}」を適用しました`,
        `${opt?.description}（秒数・演出も自動最適化）`
      );
    }
  };

  const handleResetAllSettings = () => {
    const updated = photos.map((p) => ({
      ...p,
      lockedDuration: undefined,
      transitionType: undefined,
    }));
    onPhotosChange(updated);
    if (onNotify) {
      onNotify('info', '秒数と演出を自動設定に戻しました');
    }
  };

  const handleShuffle = () => {
    if (photos.length <= 1) return;
    const reordered = shufflePhotos(photos);
    onPhotosChange(reordered);
    if (onNotify) {
      onNotify('info', 'シャッフル完了', '写真の順番をランダムに入れ替えました。');
    }
  };

  const handleSortByName = () => {
    if (photos.length <= 1) return;
    const reordered = sortPhotosByName(photos);
    onPhotosChange(reordered);
    if (onNotify) {
      onNotify('info', 'ファイル名順に並べ替えました');
    }
  };

  // Drag and drop reordering handlers
  const handleItemDragStart = (event: React.DragEvent, index: number) => {
    if (busy.current) { event.preventDefault(); return; }
    setDraggedIndex(index);
    event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify({ sectionId, photoId: photos[index].id }));
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleItemDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move';
    setDragOverIndex(index);
  };
  const handleItemDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault(); event.stopPropagation();
    setDraggedIndex(null); setDragOverIndex(null);
    if (busy.current) return;
    const target = photos[index];
    if (event.dataTransfer.files.length) {
      if (event.dataTransfer.files.length !== 1) { onError('差し替えは1枚ずつ行ってください', '複数の素材は「写真・動画を追加」へドロップしてください。'); return; }
      void replacePhotoFile(event.dataTransfer.files[0], target);
      return;
    }
    try {
      const source = JSON.parse(event.dataTransfer.getData(MEDIA_DRAG_TYPE));
      if (source.sectionId !== sectionId || typeof source.photoId !== 'string') return;
      onPhotosChange(current => moveMedia(current, source.photoId, target.id));
    } catch { /* Ignore native image, link and unrelated drags. */ }
  };

  // Open Duration/Transition Editor for a photo
  const handleOpenDetailEditor = (index: number) => {
    const photo = photos[index];
    setEditingPhotoIndex(index);
    setCustomDurationInput(photo.lockedDuration ? String(photo.lockedDuration) : '');
    setSelectedTransition(photo.transitionType);
  };

  // Apply Changes to the active photo
  const handleSavePhotoDetails = (
    duration: number | undefined,
    transType: TransitionType | undefined
  ) => {
    if (editingPhotoIndex === null) return;
    const updated = [...photos];
    updated[editingPhotoIndex] = {
      ...updated[editingPhotoIndex],
      lockedDuration: duration && duration > 0 ? duration : undefined,
      transitionType: transType,
    };
    onPhotosChange(updated);
    setEditingPhotoIndex(null);
  };

  const handleCustomDurationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customDurationInput);
    const duration = !isNaN(val) && val > 0 ? Math.round(val * 10) / 10 : undefined;
    handleSavePhotoDetails(duration, selectedTransition);
  };

  const activeEditingPhoto = editingPhotoIndex !== null ? photos[editingPhotoIndex] : null;
  const hasAnyCustomSetting = photos.some(
    (p) => (p.lockedDuration && p.lockedDuration > 0) || p.transitionType
  );

  const isTitleCoverActive = coverSettings.titleCover.enabled && !!coverSettings.titleCover.photo;
  const isEndingCoverActive = coverSettings.endingCover.enabled && !!coverSettings.endingCover.photo;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {/* Invisible inputs */}
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceFileChange}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
      />
      <input
        type="file"
        ref={titleCoverInputRef}
        onChange={(e) => handleTitleCoverUpload(e.target.files)}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
      />
      <input
        type="file"
        ref={endingCoverInputRef}
        onChange={(e) => handleEndingCoverUpload(e.target.files)}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic"
        className="hidden"
      />

      {/* Title & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
            ステップ 2：写真・動画の配置と演出指定
          </h2>
          <p className="text-[#58534E] text-sm mt-1.5">
            ドラッグ＆ドロップで並べ替えや個別差し替えができます。オープニング・エンディング表紙の設定も可能です。
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold border flex flex-col items-start gap-1 ${
              timeline?.hasInsufficientTime
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : timeline?.isExceeded
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-[#FAF9F5] border-[#E5E1D6] text-[#1C1917]'
            }`}
          >
            <span>このセクション：写真 {stillPhotos.length}枚 / 動画 {videoCount}本</span>
            <span className="text-[11px] text-[#58534E]">
              写真の目安：最大{maxPhotosAllowed}枚（自動配分は1枚1.5秒以上）
            </span>
            <span className="text-[11px] text-[#58534E]">
              {stillPhotos.length === 0
                ? '写真を追加すると表示秒数を計算します'
                : automaticPhotoCount === 0
                  ? `写真${stillPhotos.length}枚は表示秒数を固定しています`
                  : timeline?.hasInsufficientTime
                    ? '写真の表示時間が不足しています。セクションの長さ・素材数を調整してください'
                    : `自動配分の写真${automaticPhotoCount}枚：1枚あたり約${(availablePhotoTime / automaticPhotoCount).toFixed(1)}秒`}
            </span>
          </div>

          {photos.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-[#8E8880] hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
            >
              すべて削除
            </button>
          )}
        </div>
      </div>

      {/* Opening & Ending Cover Settings Card */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E1D6] p-4 mb-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm text-[#1C1917]">表紙・エンドカード設定</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F1EA] text-[#58534E] font-medium border border-[#E5E1D6]">
              {isTitleCoverActive || isEndingCoverActive ? '設定中' : 'デフォルトOFF'}
            </span>
          </div>

          <button
            onClick={() => setIsCoverSectionOpen(!isCoverSectionOpen)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
          >
            {isCoverSectionOpen ? '閉じる ▲' : '設定を開く ▼'}
          </button>
        </div>

        {isCoverSectionOpen && (
          <div className="mt-4 pt-4 border-t border-[#E5E1D6] grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Title Cover */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E1D6]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={coverSettings.titleCover.enabled}
                    onChange={(e) =>
                      onCoverSettingsChange({
                        ...coverSettings,
                        titleCover: { ...coverSettings.titleCover, enabled: e.target.checked },
                      })
                    }
                    className="rounded accent-amber-600 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-[#1C1917]">🎬 オープニング表紙</span>
                </label>

                {coverSettings.titleCover.enabled && (
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-[#8E8880]">秒数:</span>
                    <select
                      value={coverSettings.titleCover.duration}
                      onChange={(e) =>
                        onCoverSettingsChange({
                          ...coverSettings,
                          titleCover: {
                            ...coverSettings.titleCover,
                            duration: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="bg-white border border-[#CDC7B8] rounded px-1.5 py-0.5 text-xs font-bold"
                    >
                      {[2.0, 2.5, 3.0, 3.5, 4.0, 5.0].map((s) => (
                        <option key={s} value={s}>
                          {s.toFixed(1)}s
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {coverSettings.titleCover.enabled ? (
                coverSettings.titleCover.photo ? (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-[#E5E1D6]">
                    <img
                      src={coverSettings.titleCover.photo.previewUrl}
                      alt="Opening Cover"
                      className="w-14 h-10 object-cover rounded-lg border border-[#E5E1D6]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1C1917] truncate">
                        {coverSettings.titleCover.photo.name}
                      </p>
                      <p className="text-[10px] text-[#8E8880]">動画の最初（0s〜）に表示</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => titleCoverInputRef.current?.click()}
                        title="画像を差し替え"
                        className="p-1.5 text-xs text-[#58534E] hover:text-[#1C1917] hover:bg-[#F4F1EA] rounded-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          onCoverSettingsChange({
                            ...coverSettings,
                            titleCover: { ...coverSettings.titleCover, photo: undefined },
                          })
                        }
                        title="画像を削除"
                        className="p-1.5 text-xs text-[#8E8880] hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => titleCoverInputRef.current?.click()}
                    className="w-full py-3 border border-dashed border-[#CDC7B8] hover:border-[#1C1917] bg-white rounded-xl text-xs font-semibold text-[#58534E] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>オープニング表紙画像を選択</span>
                  </button>
                )
              ) : (
                <p className="text-[11px] text-[#8E8880]">
                  ONにすると、動画の一番最初に専用の表紙画像を差し込みます。
                </p>
              )}
            </div>

            {/* 2. Ending Cover */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E1D6]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={coverSettings.endingCover.enabled}
                    onChange={(e) =>
                      onCoverSettingsChange({
                        ...coverSettings,
                        endingCover: { ...coverSettings.endingCover, enabled: e.target.checked },
                      })
                    }
                    className="rounded accent-amber-600 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-xs text-[#1C1917]">🎬 エンディング表紙</span>
                </label>

                {coverSettings.endingCover.enabled && (
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-[#8E8880]">秒数:</span>
                    <select
                      value={coverSettings.endingCover.duration}
                      onChange={(e) =>
                        onCoverSettingsChange({
                          ...coverSettings,
                          endingCover: {
                            ...coverSettings.endingCover,
                            duration: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="bg-white border border-[#CDC7B8] rounded px-1.5 py-0.5 text-xs font-bold"
                    >
                      {[2.5, 3.0, 3.5, 4.0, 5.0, 6.0].map((s) => (
                        <option key={s} value={s}>
                          {s.toFixed(1)}s
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {coverSettings.endingCover.enabled ? (
                coverSettings.endingCover.photo ? (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-[#E5E1D6]">
                    <img
                      src={coverSettings.endingCover.photo.previewUrl}
                      alt="Ending Cover"
                      className="w-14 h-10 object-cover rounded-lg border border-[#E5E1D6]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1C1917] truncate">
                        {coverSettings.endingCover.photo.name}
                      </p>
                      <p className="text-[10px] text-[#8E8880]">動画の最後（エンド）に表示</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => endingCoverInputRef.current?.click()}
                        title="画像を差し替え"
                        className="p-1.5 text-xs text-[#58534E] hover:text-[#1C1917] hover:bg-[#F4F1EA] rounded-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          onCoverSettingsChange({
                            ...coverSettings,
                            endingCover: { ...coverSettings.endingCover, photo: undefined },
                          })
                        }
                        title="画像を削除"
                        className="p-1.5 text-xs text-[#8E8880] hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => endingCoverInputRef.current?.click()}
                    className="w-full py-3 border border-dashed border-[#CDC7B8] hover:border-[#1C1917] bg-white rounded-xl text-xs font-semibold text-[#58534E] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>エンディング表紙画像を選択</span>
                  </button>
                )
              ) : (
                <p className="text-[11px] text-[#8E8880]">
                  ONにすると、動画の一番最後に感謝メッセージやエンドカード画像を差し込みます。
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Smart Ordering Toolbar (when photos are present) */}
      {photos.length > 0 && (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E5E1D6] p-3 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1917]">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>アシストツール:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button disabled={isLoading} onClick={() => {
              onPhotosChange(current => autoEffects(current, song, timeline));
              onEffectsApplied();
              onNotify?.('success', '効果だけを自動設定しました', '写真の順番・秒数・セクションは変更していません。');
            }} className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">効果だけおまかせ（順番を維持）</button>
            {/* Pattern Selector Button with Dropdown Menu */}
            <div className="relative" ref={patternMenuRef}>
              <div className="inline-flex rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => handleApplyPattern(selectedPattern)}
                  title={`現在のパターン「${SONG_FLOW_PATTERNS.find((p) => p.id === selectedPattern)?.shortName}」で最適化します`}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5 text-white" />
                  <span>
                    曲の流れに合わせる（{SONG_FLOW_PATTERNS.find((p) => p.id === selectedPattern)?.shortName}）
                  </span>
                </button>
                <button
                  onClick={() => setIsPatternMenuOpen(!isPatternMenuOpen)}
                  title="おまかせ並べ替えパターンを選択"
                  className="px-2 py-2 bg-amber-600 hover:bg-amber-700 text-white transition-colors border-l border-amber-400/40 flex items-center justify-center cursor-pointer"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isPatternMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Dropdown Popover */}
              {isPatternMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 bg-[#FFFFFF] rounded-2xl border border-[#E5E1D6] p-2 shadow-xl z-50 flex flex-col gap-1">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#8E8880] border-b border-[#E5E1D6]/60 flex items-center justify-between">
                    <span>おまかせ並べ替えパターンを選択</span>
                    <span className="text-[10px] font-normal">全4種類</span>
                  </div>
                  {SONG_FLOW_PATTERNS.map((opt) => {
                    const isSelected = selectedPattern === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleApplyPattern(opt.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-600 bg-amber-50/60 text-[#1C1917] ring-1 ring-amber-600 shadow-2xs'
                            : 'border-transparent hover:bg-[#FAF9F5] text-[#1C1917]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{opt.icon}</span>
                            <span className="font-bold text-xs">{opt.name}</span>
                          </div>
                          <span
                            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-amber-600 text-white'
                                : 'bg-[#F4F1EA] text-[#58534E]'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#58534E] mt-1 pl-6 leading-relaxed">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reset All Settings to Auto */}
            {hasAnyCustomSetting && (
              <button
                onClick={handleResetAllSettings}
                title="すべての写真の秒数・演出の個別設定を解除し、自動設定に戻します"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#F4F1EA] text-[#58534E] hover:text-[#1C1917] border border-[#E5E1D6] text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>自動に戻す</span>
              </button>
            )}

            {/* Random Shuffle */}
            <button
              onClick={handleShuffle}
              title="写真の順番をランダムにシャッフルします"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#F4F1EA] text-[#58534E] hover:text-[#1C1917] border border-[#E5E1D6] text-xs font-semibold transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>シャッフル</span>
            </button>

            {/* Sort by Name */}
            <button
              onClick={handleSortByName}
              title="ファイル名順（撮影・連番順）に並べ替えます"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#F4F1EA] text-[#8E8880] hover:text-[#1C1917] border border-[#E5E1D6] text-xs font-medium transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>名前順</span>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Messages Banners (from timeline calculation) */}
      {timeline && timeline.messages.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-6">
          {timeline.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-start gap-3 text-sm transition-all ${
                msg.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : msg.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-[#F4F1EA] border-[#E5E1D6] text-[#1C1917]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {msg.type === 'error' && <AlertOctagon className="w-4 h-4 text-rose-600" />}
                {msg.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                {msg.type === 'info' && <Info className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs sm:text-sm">{msg.title}</div>
                <p className="mt-0.5 text-xs text-[#58534E] leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Grid & Upload Area */}
      {photos.length === 0 && !isTitleCoverActive && !isEndingCoverActive ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-amber-500 bg-amber-50/30'
              : 'border-[#CDC7B8] hover:border-[#1C1917] bg-[#FFFFFF] shadow-xs hover:shadow-sm'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            multiple
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center border border-[#E5E1D6]">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            {isLoading ? (
              <div>
                <p className="font-bold text-[#1C1917] text-base">写真・動画を処理中...</p>
                <p className="text-xs text-amber-700 font-mono mt-1">{loadingText}</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-[#1C1917] text-base sm:text-lg">
                  写真・動画をここに一括ドラッグ＆ドロップ
                </p>
                <p className="text-xs text-[#58534E] mt-1">または クリックして複数ファイルを選択</p>
                <p className="text-[11px] text-[#8E8880] mt-3">
                  写真：JPEG / PNG / WebP / HEIC / 動画：ブラウザで再生できるMP4 / WebM / MOV
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Thumbnails Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {/* Opening Cover Anchor Card */}
            {isTitleCoverActive && coverSettings.titleCover.photo && (
              <div className="relative bg-[#FFFFFF] rounded-2xl border border-amber-400 ring-1 ring-amber-400/40 overflow-hidden shadow-xs select-none">
                <div className="aspect-4/3 bg-[#F4F1EA] relative overflow-hidden">
                  <img
                    src={coverSettings.titleCover.photo.previewUrl}
                    alt="Title Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <span>🎬 オープニング表紙</span>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-600 text-white shadow-xs">
                      {coverSettings.titleCover.duration.toFixed(1)}s (固定)
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-[#FFFFFF] flex items-center justify-between border-t border-[#E5E1D6]/60">
                  <p className="text-xs text-[#1C1917] font-bold truncate flex-1">
                    {coverSettings.titleCover.photo.name}
                  </p>
                </div>
              </div>
            )}

            {/* Photos Cards */}
            {photos.map((photo, idx) => {
              const isLocked = !!photo.video || !!(photo.lockedDuration && photo.lockedDuration > 0);
              const hasCustomTransition = !!photo.transitionType;
              const segment = timeline?.segments.find((s) => s.photoIndex === idx && !s.isTitleCover && !s.isEndingCover);
              const actualDuration = segment ? segment.duration.toFixed(1) : (photo.lockedDuration || timeline?.unlockedAverageTime || 0).toFixed(1);
              const transInfo = photo.transitionType
                ? TRANSITION_OPTIONS.find((t) => t.id === photo.transitionType)
                : segment?.transitionType
                ? TRANSITION_OPTIONS.find((t) => t.id === segment.transitionType)
                : null;

              return (
                <div
                  key={photo.id}
                  data-photo-id={photo.id}
                  data-section-id={sectionId}
                  draggable={!isLoading}
                  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                  onDragStart={(e) => handleItemDragStart(e, idx)}
                  onDragOver={(e) => handleItemDragOver(e, idx)}
                  onDrop={(e) => handleItemDrop(e, idx)}
                  className={`group relative bg-[#FFFFFF] rounded-2xl border overflow-hidden shadow-xs hover:shadow-sm transition-all select-none ${
                    dragOverIndex === idx
                      ? 'border-[#1C1917] ring-2 ring-[#1C1917]/20 scale-105 z-10'
                      : isLocked || hasCustomTransition
                      ? 'border-amber-400 ring-1 ring-amber-400/40 bg-amber-50/10'
                      : 'border-[#E5E1D6]'
                  } ${draggedIndex === idx ? 'opacity-30' : 'opacity-100'}`}
                >
                  {/* Thumbnail Aspect Box */}
                  <div className="aspect-4/3 bg-[#F4F1EA] relative overflow-hidden">
                    <img
                      draggable={false}
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Index badge */}
                    <div className="absolute top-2 left-2 bg-[#1C1917]/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <GripVertical className="w-3 h-3 opacity-60" />
                      <span>#{idx + 1}{photo.video ? ' 動画' : ''}</span>
                    </div>

                    {/* Top right Action buttons: Replace & Delete */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTriggerReplacePhoto(idx);
                        }}
                        disabled={!!photo.video}
                        title="この写真を別の写真に差し替える"
                        className="p-1.5 rounded-lg bg-[#1C1917]/80 hover:bg-amber-600 text-white transition-all shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(idx);
                        }}
                        title="この写真を削除"
                        className="p-1.5 rounded-lg bg-[#1C1917]/80 hover:bg-rose-600 text-white transition-all shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Duration & Transition Settings Button Overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetailEditor(idx);
                        }}
                        title={photo.video ? "動画の使用範囲・元音声を変更する" : "表示秒数や演出を変更する"}
                        className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 shadow-xs transition-all ${
                          isLocked || hasCustomTransition
                            ? 'bg-amber-600 text-white hover:bg-amber-700 ring-1 ring-white/40'
                            : 'bg-[#1C1917]/75 text-white/90 hover:bg-[#1C1917] hover:text-white'
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Pin className="w-3 h-3 fill-current" />
                            <span>{photo.video ? (photo.video.trimEnd - photo.video.trimStart).toFixed(1) : photo.lockedDuration}s</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>~{actualDuration}s</span>
                          </>
                        )}
                        {transInfo && (
                          <span className="text-[10px] opacity-90 pl-0.5">
                            • {transInfo.icon}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Photo info footer */}
                  <div className="p-2.5 bg-[#FFFFFF] flex items-center justify-between border-t border-[#E5E1D6]/60">
                    <p className="text-xs text-[#1C1917] font-medium truncate flex-1" title={photo.name}>
                      {photo.name}
                    </p>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isLocked && (
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {photo.video ? (photo.video.trimEnd - photo.video.trimStart).toFixed(1) : photo.lockedDuration}s
                        </span>
                      )}
                      {transInfo && (
                        <span
                          className="text-[10px] font-medium text-[#58534E] bg-[#F4F1EA] px-1.5 py-0.5 rounded border border-[#E5E1D6]"
                          title={transInfo.desc}
                        >
                          {transInfo.icon} {transInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Ending Cover Anchor Card */}
            {isEndingCoverActive && coverSettings.endingCover.photo && (
              <div className="relative bg-[#FFFFFF] rounded-2xl border border-amber-400 ring-1 ring-amber-400/40 overflow-hidden shadow-xs select-none">
                <div className="aspect-4/3 bg-[#F4F1EA] relative overflow-hidden">
                  <img
                    src={coverSettings.endingCover.photo.previewUrl}
                    alt="Ending Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <span>🎬 エンディング表紙</span>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-600 text-white shadow-xs">
                      {coverSettings.endingCover.duration.toFixed(1)}s (固定)
                    </span>
                  </div>
                </div>
                <div className="p-2.5 bg-[#FFFFFF] flex items-center justify-between border-t border-[#E5E1D6]/60">
                  <p className="text-xs text-[#1C1917] font-bold truncate flex-1">
                    {coverSettings.endingCover.photo.name}
                  </p>
                </div>
              </div>
            )}

            {/* Add More Photos Card */}
            <div
              onClick={() => !isLoading && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`aspect-4/3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/40'
                  : 'border-[#CDC7B8] hover:border-[#1C1917] bg-[#FAF9F5] hover:bg-[#FFFFFF]'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center border border-[#E5E1D6]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#1C1917]">写真を追加</span>
                </>
              )}
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            multiple
            className="hidden"
          />

          {isLoading && (
            <div className="mt-4 p-3 rounded-2xl bg-[#F4F1EA] text-[#1C1917] text-xs flex items-center gap-2 border border-[#E5E1D6]">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>{loadingText}</span>
            </div>
          )}

          {/* Navigation Bar */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E5E1D6]">
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#58534E] hover:text-[#1C1917] rounded-xl hover:bg-[#F4F1EA] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>音楽の変更</span>
            </button>

            <button
              onClick={onNext}
              disabled={(photos.length === 0 && !isTitleCoverActive && !isEndingCoverActive) || isBlocked || isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-[#1C1917] hover:bg-[#292524] disabled:bg-[#E5E1D6] disabled:text-[#8E8880] disabled:cursor-not-allowed text-white font-semibold text-sm rounded-2xl shadow-xs transition-all"
            >
              <span>プレビューへ進む（ステップ3）</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Duration & Transition Detail Editor Modal */}
      {activeEditingPhoto && !activeEditingPhoto.video && (
        <div className="fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#E5E1D6] relative">
            <button
              onClick={() => setEditingPhotoIndex(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[#8E8880] hover:text-[#1C1917] hover:bg-[#F4F1EA] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header with Photo Preview & Replace Button */}
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E5E1D6]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F4F1EA] border border-[#E5E1D6] shrink-0">
                  <img
                    src={activeEditingPhoto.previewUrl}
                    alt={activeEditingPhoto.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1C1917]">写真の秒数・演出を設定</h3>
                  <p className="text-xs text-[#8E8880] truncate max-w-[150px] sm:max-w-[200px]" title={activeEditingPhoto.name}>
                    {activeEditingPhoto.name}
                  </p>
                </div>
              </div>

              {/* In-Modal Replace button */}
              <button
                onClick={() => handleTriggerReplacePhoto(editingPhotoIndex!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5E1D6] bg-[#FAF9F5] hover:bg-[#F4F1EA] text-[#1C1917] text-xs font-semibold transition-colors shrink-0 shadow-2xs"
                title="この写真を別の写真ファイルに差し替えます"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                <span>差し替え</span>
              </button>
            </div>

            {/* Section 1: Duration Settings */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-xs text-[#1C1917]">表示秒数の指定</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleSavePhotoDetails(undefined, selectedTransition)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                    !activeEditingPhoto.lockedDuration
                      ? 'border-[#1C1917] bg-[#1C1917] text-white shadow-xs'
                      : 'border-[#E5E1D6] text-[#58534E] hover:bg-[#FAF9F5]'
                  }`}
                >
                  {!activeEditingPhoto.lockedDuration && <Check className="w-3.5 h-3.5 text-white" />}
                  <span>自動均等</span>
                </button>

                {[2.0, 3.0, 4.0, 5.0, 7.0].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleSavePhotoDetails(sec, selectedTransition)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center gap-1 transition-all ${
                      activeEditingPhoto.lockedDuration === sec
                        ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-600'
                        : 'border-[#E5E1D6] text-[#58534E] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    {activeEditingPhoto.lockedDuration === sec && <Pin className="w-3 h-3 fill-amber-600 text-amber-600" />}
                    <span>{sec.toFixed(1)}s</span>
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <form onSubmit={handleCustomDurationSubmit} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1 border border-[#CDC7B8] rounded-xl px-3 py-1.5 text-xs bg-[#FAF9F5] focus-within:border-[#1C1917] focus-within:bg-white">
                  <span className="text-[#8E8880]">カスタム:</span>
                  <input
                    type="number"
                    min="0.5"
                    max={movieDuration}
                    step="0.5"
                    placeholder="3.5"
                    value={customDurationInput}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                    className="w-full bg-transparent outline-none font-mono font-bold text-[#1C1917]"
                  />
                  <span className="text-[#8E8880] font-mono">秒</span>
                </div>

                <button
                  type="submit"
                  className="py-1.5 px-3.5 rounded-xl bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-semibold transition-colors shrink-0"
                >
                  秒数を適用
                </button>
              </form>
            </div>

            {/* Section 2: Custom Transition Effect */}
            <div className="pt-4 border-t border-[#E5E1D6]">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-xs text-[#1C1917]">トランジション演出（切り替え効果）</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTransition(undefined);
                    handleSavePhotoDetails(activeEditingPhoto.lockedDuration, undefined);
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    !selectedTransition
                      ? 'border-[#1C1917] bg-[#1C1917] text-white shadow-xs'
                      : 'border-[#E5E1D6] hover:bg-[#FAF9F5] text-[#58534E]'
                  }`}
                >
                  <div className="font-bold">✨ 自動（曲に追従）</div>
                  <div className={`text-[10px] ${!selectedTransition ? 'text-white/80' : 'text-[#8E8880]'}`}>
                    全体の雰囲気設定に従う
                  </div>
                </button>

                {TRANSITION_OPTIONS.map((opt) => {
                  const isSelected = selectedTransition === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedTransition(opt.id);
                        handleSavePhotoDetails(activeEditingPhoto.lockedDuration, opt.id);
                      }}
                      className={`p-2 rounded-xl border text-xs text-left transition-all ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-600'
                          : 'border-[#E5E1D6] hover:bg-[#FAF9F5] text-[#1C1917]'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                      <div className="text-[10px] text-[#8E8880] mt-0.5 truncate">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {editingPhotoIndex !== null && activeEditingPhoto?.video && <VideoClipEditor key={activeEditingPhoto.id} photo={activeEditingPhoto}
        onClose={() => setEditingPhotoIndex(null)} onSave={photo => onPhotosChange(photos.map(item => item.id === photo.id ? photo : item))} />}
    </div>
  );
};
