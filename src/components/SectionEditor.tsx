import { useState } from 'react';
import type { DurationPlan } from '../core/timeline/durationPlan';
import { ArrowDown, ArrowUp, Plus, Trash2, Layers } from 'lucide-react';
import type { ProjectSection, SectionRange } from '../types/project';
import { sectionContentDuration } from '../core/timeline/sections';

interface Props {
  continuous?: boolean;
  durationPlan: DurationPlan;
  sections: ProjectSection[];
  activeId: string;
  ranges: SectionRange[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onUpdate: (patch: Partial<ProjectSection>) => void;
}
const inputClass = 'w-full border border-[#CDC7B8] rounded-xl px-3 py-2 bg-white text-sm';
const time = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

function DurationInput({ value, onChange }: { value: number; onChange: (duration: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const valid = draft === null || (draft.trim() !== '' && Number.isFinite(Number(draft)) && Number(draft) >= 0.1 && Number(draft) <= 3600);
  return <>
    <input aria-label="セクションの長さ（秒）" aria-invalid={!valid} type="number" min="0.1" max="3600" step="0.1" className={inputClass}
      value={draft ?? Number(value.toFixed(3))}
      onChange={event => {
        const text = event.target.value;
        setDraft(text);
        const duration = Number(text);
        if (text.trim() && Number.isFinite(duration) && duration >= 0.1 && duration <= 3600) onChange(duration);
      }}
      onBlur={() => setDraft(null)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    {!valid && <span className="block text-red-700">0.1〜3600秒で入力してください。入力を離れると直前の有効な値に戻ります。</span>}
  </>;
}

export function SectionEditor({ durationPlan, continuous = false, sections, activeId, ranges, onSelect, onAdd, onMove, onDelete, onUpdate }: Props) {
  const active = sections.find(section => section.id === activeId) ?? sections[0];
  const duration = ranges.find(range => range.id === active.id)?.duration ?? active.duration;
  const musicDuration = active.song ? active.song.trimEnd - active.song.trimStart : 0;
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8" aria-label="セクション編集">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div><h2 className="font-bold text-lg flex items-center gap-2"><Layers className="w-5 h-5" />セクション構成</h2>
          <p className="text-sm text-stone-500 mt-1">順番に1本の動画へつながります。{continuous && durationPlan.target === null ? '全体時間は楽曲選択後に確定します（現在は仮の時間）' : `全体 ${time(continuous ? durationPlan.target ?? durationPlan.total : durationPlan.total)}`}</p></div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-stone-900 text-white rounded-xl px-4 py-2 text-sm"><Plus className="w-4 h-4" />セクションを追加</button>
      </div>
      {continuous && <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 text-sm" aria-label="時間の配分状況">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <span>楽曲の使用時間：<b>{durationPlan.target === null ? '未確定' : `${durationPlan.target.toFixed(2)}秒`}</b></span>
          <span>セクション合計：<b>{durationPlan.total.toFixed(2)}秒</b></span>
          <span>手動指定：<b>{durationPlan.manualTotal.toFixed(2)}秒</b></span>
          <span>自動配分に使える残り：<b>{durationPlan.remaining === null ? '未確定' : `${durationPlan.remaining.toFixed(2)}秒`}</b></span>
          <span>自動配分：<b>{durationPlan.autoCount}セクション</b></span>
        </div>
        <p className="text-xs text-stone-500 mt-2">手動の時間を確保した後、残りを自動配分します。楽曲のトリミング・セクションの追加や削除・素材の変更に合わせて再計算します。</p>
        {durationPlan.messages.map((message, index) => <p key={index} role="alert" className="text-red-700 mt-2">{message.title}：{message.text}</p>)}
        {durationPlan.target !== null && !durationPlan.messages.length && <p role="status" className="text-emerald-700 mt-2">楽曲の長さに一致しています。</p>}
      </div>}
      <ol className="flex gap-3 overflow-x-auto pb-3">
        {sections.map((section, index) => (
          <li key={section.id} className={`shrink-0 w-56 border rounded-2xl p-3 ${section.id === activeId ? 'border-amber-600 bg-amber-50' : 'border-stone-200 bg-white'}`}>
            <button onClick={() => onSelect(section.id)} aria-pressed={section.id === activeId} className="w-full text-left">
              <span className="text-xs text-stone-500">{index + 1} / {time(ranges[index].startTime)}〜</span>
              <span className="block font-bold truncate mt-1">{section.name}</span>
              <span className="block text-xs text-stone-600 mt-1">{ranges[index].duration.toFixed(1)}秒{section.durationMode === 'auto' ? '（自動）' : ''} · 写真 {section.photos.filter(p => !p.video).length} · 動画 {section.photos.filter(p => p.video).length}</span>
              <span className="block truncate text-xs text-stone-500 mt-1">{continuous ? '全体の楽曲を通して再生' : section.song?.name ?? 'BGMなし'}</span>
            </button>
            <div className="flex justify-end gap-1 mt-2">
              <button aria-label={`${section.name}を前へ`} disabled={!index} onClick={() => onMove(section.id, -1)} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
              <button aria-label={`${section.name}を後ろへ`} disabled={index === sections.length - 1} onClick={() => onMove(section.id, 1)} className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
              <button aria-label={`${section.name}を削除`} disabled={sections.length === 1} onClick={() => onDelete(section.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-700 disabled:opacity-25"><Trash2 className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
      </ol>
      <div className="bg-white border border-stone-200 rounded-2xl p-5 mt-2">
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-xs font-semibold space-y-2">セクション名<input aria-label="セクション名" className={inputClass} value={active.name} onChange={e => onUpdate({ name: e.target.value })} /></label>
          <label className="text-xs font-semibold space-y-2">長さの設定<select className={inputClass} value={active.durationMode} onChange={e => onUpdate({ durationMode: e.target.value as ProjectSection['durationMode'], duration })}>
            {continuous && <option value="auto">残り時間から自動配分</option>}{!continuous && <option value="music">トリミングした楽曲に合わせる</option>}<option value="custom">秒数を指定する</option>
          </select></label>
          <label className="text-xs font-semibold space-y-2">セクションの長さ（秒）<DurationInput key={active.id} value={duration} onChange={duration => onUpdate({ durationMode: 'custom', duration })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-stone-500">
          <p>秒数を直接入力すると手動指定に切り替わります。表紙・エンドカード・動画を含む長さです。</p>
          <button className="text-amber-800 underline" onClick={() => onUpdate({ durationMode: 'custom', duration: Math.max(0.1, sectionContentDuration(active)) })}>素材の長さに合わせる</button>
        </div>
        {!continuous && <><div className="grid sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-stone-100">
          <label className="text-xs font-semibold space-y-2">楽曲フェードイン（秒）<input type="number" min="0" max="10" step="0.1" className={inputClass} value={active.audioFadeIn} onChange={e => onUpdate({ audioFadeIn: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} /></label>
          <label className="text-xs font-semibold space-y-2">楽曲フェードアウト（秒）<input type="number" min="0" max="10" step="0.1" className={inputClass} value={active.audioFadeOut} onChange={e => onUpdate({ audioFadeOut: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} /></label>
          <label className="text-xs font-semibold space-y-2">BGM音量（%）<input type="number" min="0" max="100" step="5" className={inputClass} value={Math.round(active.musicVolume * 100)} onChange={e => onUpdate({ musicVolume: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })} /></label>
        </div>
        <p className="text-xs text-stone-500 mt-3">各楽曲はセクションの先頭から再生し、使用範囲の冒頭・末尾で滑らかにフェードします。</p>
        {active.song && duration > musicDuration + 0.01 && <p role="status" className="text-xs text-amber-800 mt-2">楽曲は{musicDuration.toFixed(1)}秒でフェードアウトします。残りの{(duration - musicDuration).toFixed(1)}秒はBGMなしです。</p>}
        {active.song && <button onClick={() => onUpdate({ song: null })} className="text-xs text-stone-600 underline mt-3">このセクションのBGMを外す</button>}</>}
      </div>
    </section>
  );
}
