import React from 'react';
import {
  Music,
  Image as ImageIcon,
  Film,
  ShieldCheck,
  RotateCcw,
  Check,
  HelpCircle,
} from 'lucide-react';
import { KanaderuLogo } from './KanaderuLogo';

interface HeaderProps {
  currentStep: 1 | 2 | 3;
  onStepClick: (step: 1 | 2 | 3) => void;
  hasSong: boolean;
  hasPhotos: boolean;
  onReset: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onStepClick,
  hasSong,
  hasPhotos,
  onReset,
  onOpenGuide,
}) => {
  const steps = [
    { number: 1, label: '音楽・尺の確定', icon: Music, ready: true },
    { number: 2, label: 'セクション構成', icon: ImageIcon, ready: hasSong },
    { number: 3, label: 'プレビュー・出力', icon: Film, ready: hasSong && hasPhotos },
  ] as const;

  return (
    <header className="bg-[#FAF9F5]/90 backdrop-blur-md border-b border-[#E5E1D6] sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <KanaderuLogo className="w-9 h-9 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-[#1C1917] tracking-tight">
                Kanaderu
              </h1>
              <span className="hidden sm:inline text-[10px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#F4F1EA] text-[#58534E] border border-[#E5E1D6]">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-[#8E8880] hidden sm:block">
              セクションごとに音楽・写真・動画をつなぐ
            </p>
          </div>
        </div>

        {/* Step Wizard Navigation */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            const isClickable = step.ready;

            return (
              <React.Fragment key={step.number}>
                {idx > 0 && (
                  <div
                    className={`w-3 sm:w-6 h-[1.5px] rounded-full transition-colors ${
                      isCompleted ? 'bg-[#1C1917]' : 'bg-[#E5E1D6]'
                    }`}
                  />
                )}
                <button
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={!isClickable}
                  className={`group flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#1C1917] text-white shadow-xs'
                      : isCompleted
                      ? 'bg-[#F4F1EA] text-[#1C1917] hover:bg-[#EAE6DC]'
                      : 'text-[#8E8880] hover:text-[#58534E] disabled:opacity-40 disabled:hover:text-[#8E8880]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Right Action: Help / Guide, Privacy Badge, Reset */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenGuide}
            title="使い方マニュアルを見る"
            className="flex items-center gap-1 text-xs font-semibold text-[#58534E] hover:text-[#1C1917] bg-[#FFFFFF] border border-[#E5E1D6] px-2.5 py-1.5 rounded-xl hover:bg-[#F4F1EA] transition-colors shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">使い方</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#58534E] bg-[#F4F1EA] border border-[#E5E1D6] px-3 py-1 rounded-full font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>端末内完結</span>
          </div>

          {(hasSong || hasPhotos) && (
            <button
              onClick={onReset}
              title="最初からやり直す"
              className="flex items-center gap-1 text-xs text-[#8E8880] hover:text-rose-600 hover:bg-rose-50/60 px-2 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">リセット</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
