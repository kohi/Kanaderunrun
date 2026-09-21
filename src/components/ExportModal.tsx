import React, { useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ExportProgress } from '../types/project';

interface ExportModalProps {
  progress: ExportProgress;
  onCancel: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  progress,
  onCancel,
  onClose,
}) => {
  const isCompleted = progress.state === 'completed';
  const isError = progress.state === 'error';
  const isCancelled = progress.state === 'cancelled';
  const isRunning =
    progress.state === 'preparing' ||
    progress.state === 'encoding' ||
    progress.state === 'muxing';

  useEffect(() => {
    if (isCompleted && progress.downloadUrl) {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#EA580C', '#1C1917', '#F59E0B', '#E5E1D6'],
      });

      // Automatically trigger MP4 download once
      try {
        const link = document.createElement('a');
        link.href = progress.downloadUrl;
        link.download = progress.filename || 'movie.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error('Auto download failed:', e);
      }
    }
  }, [isCompleted, progress.downloadUrl, progress.filename]);

  const formatTime = (ms: number) => {
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1C1917]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-xl border border-[#E5E1D6] relative">
        {/* Close Button when done or error */}
        {(isCompleted || isError || isCancelled) && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-[#8E8880] hover:text-[#1C1917] hover:bg-[#F4F1EA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* State 1: Running */}
        {isRunning && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F4F1EA] text-[#1C1917] flex items-center justify-center mx-auto mb-4 border border-[#E5E1D6]">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>

            <h3 className="text-lg font-bold text-[#1C1917]">
              {progress.state === 'preparing'
                ? 'ムービーの準備中...'
                : progress.state === 'muxing'
                ? 'MP4コンテナを出力中...'
                : 'MP4ムービーを書き出し中...'}
            </h3>
            <p className="text-xs text-[#58534E] mt-1">
              WebCodecs（H.264 + AAC）で高速エンコードしています
            </p>

            {/* Progress Bar */}
            <div className="mt-6 mb-2">
              <div className="h-2.5 w-full bg-[#F4F1EA] rounded-full overflow-hidden p-0.5 border border-[#E5E1D6]">
                <div
                  className="h-full bg-[#1C1917] rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-[#8E8880] mt-2 font-mono">
                <span>
                  {progress.encodedFrames} / {progress.totalFrames} frames
                </span>
                <span className="font-bold text-[#1C1917] text-sm">{progress.percent}%</span>
              </div>
            </div>

            {/* Timings */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-[#FAF9F5] rounded-2xl text-xs text-[#58534E] border border-[#E5E1D6]">
              <div>
                <span className="text-[#8E8880] block text-[11px]">経過時間</span>
                <span className="font-mono font-bold text-[#1C1917]">{formatTime(progress.elapsedMs)}</span>
              </div>
              <div>
                <span className="text-[#8E8880] block text-[11px]">残り予測</span>
                <span className="font-mono font-bold text-[#1C1917]">
                  {progress.estimatedRemainingMs > 0
                    ? `約 ${formatTime(progress.estimatedRemainingMs)}`
                    : 'まもなく完了'}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={onCancel}
              className="mt-6 w-full py-2.5 px-4 rounded-xl border border-[#E5E1D6] text-[#58534E] text-xs font-semibold hover:bg-[#FAF9F5] hover:text-rose-600 transition-colors"
            >
              書き出しをキャンセル
            </button>
          </div>
        )}

        {/* State 2: Completed */}
        {isCompleted && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-2 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>書き出し完了</span>
            </div>

            <h3 className="text-lg font-bold text-[#1C1917]">ムービーが完成しました</h3>
            <p className="text-xs font-mono text-[#8E8880] mt-1 max-w-xs mx-auto">
              {progress.filename} ({progress.blob ? (progress.blob.size / (1024 * 1024)).toFixed(1) : '0'} MB)
            </p>

            <div className="flex flex-col gap-3 mt-6">
              {progress.downloadUrl && (
                <a
                  href={progress.downloadUrl}
                  download={progress.filename || 'movie.mp4'}
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-bold shadow-xs transition-all hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>MP4動画を保存する（ダウンロード）</span>
                </a>
              )}

              <p className="text-xs text-[#58534E] bg-[#FAF9F5] p-3 rounded-2xl border border-[#E5E1D6] leading-relaxed text-left">
                💡 <b>共有方法:</b> ダウンロードしたMP4動画は、LINEのトーク画面やInstagram、X（旧Twitter）、TikTok等にそのままドラッグ＆ドロップまたはファイル添付で送信できます。
              </p>

              <button
                onClick={onClose}
                className="py-2 px-4 text-xs font-medium text-[#8E8880] hover:text-[#1C1917] transition-colors"
              >
                プレビュー画面に戻る
              </button>
            </div>
          </div>
        )}

        {/* State 3: Error / Cancelled */}
        {(isError || isCancelled) && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-[#1C1917]">
              {isCancelled ? '書き出しを中止しました' : '書き出しに失敗しました'}
            </h3>
            <p className="text-xs text-rose-700 mt-2 max-w-xs mx-auto leading-relaxed">
              {progress.error || '処理中にエラーが発生しました。'}
            </p>

            <button
              onClick={onClose}
              className="mt-6 w-full py-3 px-6 rounded-2xl bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-semibold transition-colors"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
