import { useState } from 'react';
import type { PhotoItem } from '../types/project';

export function VideoClipEditor({ photo, onSave, onClose }: { photo: PhotoItem; onSave: (photo: PhotoItem) => void; onClose: () => void }) {
  const clip = photo.video!;
  const [start, setStart] = useState(String(clip.trimStart));
  const [end, setEnd] = useState(String(clip.trimEnd));
  const [volume, setVolume] = useState(clip.volume);
  const valid = start !== '' && end !== '' && Number.isFinite(Number(start)) && Number.isFinite(Number(end)) && Number(start) >= 0 && Number(end) <= clip.duration + 0.001 && Number(end) - Number(start) >= 0.1;
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="動画の編集" className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between gap-4 mb-4"><h3 className="font-bold truncate">動画の編集：{photo.name}</h3><button aria-label="閉じる" onClick={onClose}>✕</button></div>
      <video src={clip.url} controls playsInline className="w-full max-h-60 bg-black rounded-xl" />
      <p className="text-xs text-stone-500 mt-2">素材の長さ {clip.duration.toFixed(2)}秒。選択範囲を等速で挿入します。</p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <label className="text-sm">開始（秒）<input aria-label="動画の開始（秒）" type="number" min="0" max={clip.duration} step="0.1" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded-xl p-2 mt-2" /></label>
        <label className="text-sm">終了（秒）<input aria-label="動画の終了（秒）" type="number" min="0.1" max={clip.duration} step="0.1" value={end} onChange={e => setEnd(e.target.value)} className="w-full border rounded-xl p-2 mt-2" /></label>
      </div>
      <label className="text-sm block mt-4">動画の元音声：{Math.round(volume * 100)}%<input aria-label="動画の元音声音量" type="range" min="0" max="1" step="0.05" value={volume} disabled={!clip.audioBuffer} onChange={e => setVolume(Number(e.target.value))} className="w-full mt-2" /></label>
      <p className="text-xs text-stone-500">{clip.audioBuffer ? '初期設定はミュートです。元音声を有効にするとBGMと重ねて再生します。上の素材プレーヤーは元ファイルの試聴用です。' : 'この動画には読み取り可能な音声がありません。映像のみ使用します。'}</p>
      {!valid && <p role="alert" className="text-red-700 text-sm mt-3">動画の範囲内で、0.1秒以上の開始・終了位置を指定してください。</p>}
      <div className="flex justify-end gap-3 mt-5"><button onClick={onClose} className="px-4 py-2 border rounded-xl">キャンセル</button>
        <button disabled={!valid} onClick={() => { onSave({ ...photo, lockedDuration: undefined, video: { ...clip, trimStart: Number(start), trimEnd: Number(end), volume } }); onClose(); }} className="px-4 py-2 bg-stone-900 text-white rounded-xl disabled:opacity-40">使用範囲を保存</button></div>
    </section>
  </div>;
}
