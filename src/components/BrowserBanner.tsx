import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CapabilityStatus } from '../types/project';

interface BrowserBannerProps {
  status: CapabilityStatus | null;
}

export const BrowserBanner: React.FC<BrowserBannerProps> = ({ status }) => {
  if (!status || status.isSupported) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-3 text-xs sm:text-sm">
      <div className="max-w-6xl mx-auto flex items-start sm:items-center gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1">
          <span className="font-bold">ブラウザ対応に関する注意：</span>{' '}
          {status.errorMessage ||
            'お使いのブラウザでは動画の書き出し機能（WebCodecs H.264/AAC）が制限されている可能性があります。'}
          <span className="ml-2 inline-block text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300/60 px-2 py-0.5 rounded-full">
            デスクトップ版 Chrome / Edge 推奨
          </span>
        </div>
      </div>
    </div>
  );
};
