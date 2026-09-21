import React, { useState } from 'react';
import {
  Music,
  Image as ImageIcon,
  Film,
  ShieldCheck,
  Smartphone,
  Sliders,
  Sparkles,
  X,
  Pin,
  Wand2,
  HelpCircle,
  Check,
} from 'lucide-react';
import { KanaderuLogo } from './KanaderuLogo';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [activeTab, setActiveTab] = useState<'steps' | 'tips' | 'faq'>('steps');

  if (!isOpen) return null;

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1C1917]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#FFFFFF] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E5E1D6] relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[#8E8880] hover:text-[#1C1917] hover:bg-[#F4F1EA] transition-colors"
          title="閉じる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-[#E5E1D6]">
          <KanaderuLogo className="w-11 h-11 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1C1917] tracking-tight">
                Kanaderu 使い方ガイド
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                クイックマニュアル
              </span>
            </div>
            <p className="text-xs text-[#58534E] mt-0.5">
              セクションごとに音楽・写真・動画を配置して、1本の思い出ムービーを作成します。
            </p>
          </div>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-amber-50 text-xs text-stone-700 leading-relaxed">
          <b>音楽から作成：</b>まず音楽を読み込み・トリミングし、「この尺で確定してセクション構成へ」を押します。ステップ2でセクションを追加・選択し、矢印で順番を変更できます。各セクションに長さ、楽曲のトリミングとフェード、表紙・エンドカードを設定してください。写真と動画を同じ一覧に配置でき、動画の秒数ボタンから使用範囲と元音声を編集できます。最後のプレビュー・書き出しは全セクションが対象です。
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4 bg-[#F4F1EA] p-1 rounded-2xl border border-[#E5E1D6] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'steps'
                ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                : 'text-[#58534E] hover:text-[#1C1917]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>3ステップ作成手順</span>
          </button>

          <button
            onClick={() => setActiveTab('tips')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tips'
                ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                : 'text-[#58534E] hover:text-[#1C1917]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-600" />
            <span>便利なこだわり機能</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'faq'
                ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                : 'text-[#58534E] hover:text-[#1C1917]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>よくある質問</span>
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs sm:text-sm text-[#1C1917] leading-relaxed">
          {activeTab === 'steps' && (
            <div className="space-y-3.5">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6] flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  1
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-sm text-[#1C1917]">音楽を選ぶ</h3>
                  </div>
                  <p className="text-xs text-[#58534E] mt-1">
                    お好きな楽曲ファイル（MP3 / M4A / WAV 等）をドラッグ＆ドロップ。BPMとビートが自動解析されます。
                    サビだけ使いたい場合はスライダーで開始・終了位置を自由にトリミングして試聴できます。
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6] flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-sm text-[#1C1917]">写真を配置・秒数を指定</h3>
                  </div>
                  <p className="text-xs text-[#58534E] mt-1">
                    思い出の写真をまとめて追加。ドラッグ＆ドロップで順番を自由に入れ替えられます。
                    <span className="font-semibold text-[#1C1917]">「曲の流れに合わせる」</span>ボタンを押すと、曲のサビ・盛り上がりに合わせて自動でドラマチックに並べ替えられます。
                    特定の写真を長く見せたい場合は、写真をクリックして<span className="font-semibold text-amber-700">「表示秒数をピン留め（📌）」</span>できます。
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6] flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                  3
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-sm text-[#1C1917]">プレビュー＆MP4書き出し</h3>
                  </div>
                  <p className="text-xs text-[#58534E] mt-1">
                    ビートに同期したKen Burnsやトランジション演出をリアルタイムで確認。<br />
                    お好みでアスペクト比（横向き16:9 / 縦向き9:16）やフェードイン・フェードアウトを設定し、
                    <span className="font-semibold text-[#1C1917]">「MP4を書き出す」</span>を押すだけで完成動画が自動ダウンロードされます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="flex items-center gap-2 font-bold text-xs text-[#1C1917] mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>完全端末内処理（高セキュリティ）</span>
                </div>
                <p className="text-[11px] text-[#58534E] leading-relaxed">
                  すべての音楽解析・画像処理・MP4エンコードはブラウザ内（WebAssembly/WebCodecs）で完結。サーバーへ写真や曲が送信されることは一切ありません。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="flex items-center gap-2 font-bold text-xs text-[#1C1917] mb-1">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <span>縦向き（9:16）& 横向き（16:9）</span>
                </div>
                <p className="text-[11px] text-[#58534E] leading-relaxed">
                  YouTube用の横画面だけでなく、LINEやInstagramリール、TikTok、スマホ全画面に最適な縦長動画もワンクリックで作成できます。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="flex items-center gap-2 font-bold text-xs text-[#1C1917] mb-1">
                  <Pin className="w-4 h-4 text-amber-600" />
                  <span>写真の表示秒数ピン留め</span>
                </div>
                <p className="text-[11px] text-[#58534E] leading-relaxed">
                  「集合写真だけ5秒じっくり見せたい」といった場合も簡単。指定した写真以外の残り秒数は自動で均等再配分されます。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="flex items-center gap-2 font-bold text-xs text-[#1C1917] mb-1">
                  <Wand2 className="w-4 h-4 text-amber-600" />
                  <span>曲の流れに合わせた自動並べ替え</span>
                </div>
                <p className="text-[11px] text-[#58534E] leading-relaxed">
                  写真の色合いや鮮やかさを瞬時に判定し、曲のサビ・盛り上がりに合わせて自動で最適な順序に並べ替えます。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="font-bold text-xs text-[#1C1917]">Q. iPhoneの写真（HEIC形式）は使えますか？</div>
                <p className="text-[11px] text-[#58534E] mt-1 leading-relaxed">
                  A. はい、そのまま追加いただけます。Kanaderuがブラウザ内で自動変換し、最適な画質に自動最適化します。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="font-bold text-xs text-[#1C1917]">Q. 作成した動画はどうやってLINE等で送れますか？</div>
                <p className="text-[11px] text-[#58534E] mt-1 leading-relaxed">
                  A. 書き出されるファイルは標準的なMP4（H.264+AAC）形式です。ダウンロードフォルダに保存された動画ファイルを、LINEのトーク画面やSNSの投稿画面にそのままドラッグ＆ドロップまたはファイル添付するだけで送信できます。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E1D6]">
                <div className="font-bold text-xs text-[#1C1917]">Q. 推奨のブラウザ環境はありますか？</div>
                <p className="text-[11px] text-[#58534E] mt-1 leading-relaxed">
                  A. 高速なハードウェアエンコードを活用するため、最新のデスクトップ版 Google Chrome または Microsoft Edge を推奨しています。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Checkbox & CTA */}
        <div className="mt-5 pt-4 border-t border-[#E5E1D6] flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-[#58534E] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded accent-[#1C1917] w-4 h-4 cursor-pointer"
            />
            <span>次回起動時にこのポップアップを表示しない</span>
          </label>

          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-bold rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>Kanaderu をはじめる</span>
            <Check className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
