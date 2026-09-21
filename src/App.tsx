import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type {
  AspectRatio,
  CapabilityStatus,
  ExportProgress,
  PresetType,
  ProjectConfig,
  ProjectSection,
  SongData,
  TransitionStyle,
  VideoQuality,
} from './types/project';
import { checkBrowserCapabilities } from './core/capability/checkBrowser';
import { buildSectionTimeline, composeSections, createSection, sectionTimingSong, continuousTimingSong } from './core/timeline/sections';
import { saveProject, restoreProject, savedProjectDate } from './core/utils/projectStore';
import { updateSectionPhotos } from './core/utils/mediaEdits';
import { planSectionDurations } from './core/timeline/durationPlan';
import { releaseAsset, sectionAssets } from './core/utils/resources';
import { SectionEditor } from './components/SectionEditor';
import { exportToMp4 } from './core/exporter/mp4Exporter';
import type { ExportController } from './core/exporter/mp4Exporter';
import { loadSettings, saveSettings } from './core/utils/storage';
import { Header } from './components/Header';
import { BrowserBanner } from './components/BrowserBanner';
import { Step1Music } from './components/Step1Music';
import { Step2Photos } from './components/Step2Photos';
import { Step3Preview } from './components/Step3Preview';
import { ExportModal } from './components/ExportModal';
import { UserGuideModal } from './components/UserGuideModal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';

export function App() {
  const [mediaTasks, setMediaTasks] = useState(0);
  const onMediaTask = useCallback((delta: number) => setMediaTasks(count => Math.max(0, count + delta)), []);
  const [projectBusy, setProjectBusy] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { void savedProjectDate().then(setSavedAt).catch(() => {}); }, []);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [capability, setCapability] = useState<CapabilityStatus | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Startup / In-App User Guide state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kanaderu_hide_guide') !== 'true';
    } catch {
      return true;
    }
  });

  const handleCloseGuide = (dontShowAgain: boolean) => {
    setIsGuideOpen(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem('kanaderu_hide_guide', 'true');
      } catch {
        // ignore
      }
    }
  };

  // Project state
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => loadSettings().aspect);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>(() => loadSettings().lastVideoQuality || '1080p');
  const [preset, setPreset] = useState<PresetType>(() => loadSettings().lastPreset);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>(
    () => loadSettings().lastTransitionStyle || 'dynamic'
  );
  const [fadeIn, setFadeIn] = useState<boolean>(() => loadSettings().fadeIn ?? true);
  const [fadeInDuration, setFadeInDuration] = useState<number>(() => loadSettings().fadeInDuration ?? 0.5);
  const [fadeOut, setFadeOut] = useState<boolean>(() => loadSettings().fadeOut ?? true);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(() => loadSettings().fadeOutDuration ?? 2.0);

  const [sections, setSections] = useState<ProjectSection[]>(() => [{ ...createSection(1), durationMode: 'auto' }]);
  const [musicMode, setMusicMode] = useState<'sections' | 'continuous'>('continuous');
  const [continuousSong, setContinuousSong] = useState<SongData | null>(null);
  const [draftSong, setDraftSong] = useState<SongData | null>(null);
  const displayedSong = currentStep === 1 ? draftSong : continuousSong;
  const musicConfirmed = !!continuousSong && !!draftSong
    && continuousSong.audioBuffer === draftSong.audioBuffer
    && continuousSong.trimStart === draftSong.trimStart && continuousSong.trimEnd === draftSong.trimEnd;
  const [continuousVolume, setContinuousVolume] = useState(1);
  const [activeId, setActiveId] = useState<string>('');
  const durationPlan = useMemo(() => planSectionDurations(sections, musicMode, continuousSong), [sections, musicMode, continuousSong]);
  const activeSection = durationPlan.sections.find(section => section.id === activeId) ?? durationPlan.sections[0];
  const { song, photos, coverSettings } = activeSection;
  const updateSection = (patch: Partial<ProjectSection>) => {
    const id = activeSection.id;
    setSections(previous => previous.map(section => section.id === id ? { ...section, ...patch } : section));
  };

  const assets = useRef<ReturnType<typeof sectionAssets>>(new Map());
  useEffect(() => {
    const next = sectionAssets(sections);
    for (const [id, asset] of assets.current) if (!next.has(id) || next.get(id)?.bitmap !== asset.bitmap) releaseAsset(asset);
    assets.current = next;
  }, [sections]);
  useEffect(() => () => { assets.current.forEach(releaseAsset); assets.current.clear(); }, []);

  // Export State
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportController, setExportController] = useState<ExportController | null>(null);

  const addToast = useCallback((
    type: ToastMessage['type'],
    title: string,
    message?: string,
    detail?: string
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  // 1. Check Browser Capabilities on Mount (F13)
  useEffect(() => {
    checkBrowserCapabilities().then((status) => {
      setCapability(status);
      if (!status.isSupported && status.errorMessage) {
        addToast('warning', 'ブラウザ機能の制限', status.errorMessage);
      }
    });
  }, [addToast]);

  // 2. BeforeUnload Leave Guard (F14)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isExporting =
        exportProgress?.state === 'preparing' ||
        exportProgress?.state === 'encoding' ||
        exportProgress?.state === 'muxing';

      if (draftSong || continuousSong || sections.some(s => s.song || s.photos.length || s.coverSettings.titleCover.photo || s.coverSettings.endingCover.photo) || isExporting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sections, continuousSong, draftSong, exportProgress?.state]);

  const settings = useMemo(() => ({ seed, aspectRatio, videoQuality, preset, transitionStyle,
    fadeIn, fadeInDuration, fadeOut, fadeOutDuration, musicMode, continuousSong, continuousVolume }),
    [seed, aspectRatio, videoQuality, preset, transitionStyle, fadeIn, fadeInDuration, fadeOut, fadeOutDuration, musicMode, continuousSong, continuousVolume]);
  const composition = useMemo(() => composeSections(sections, settings), [sections, settings]);
  const activeStart = composition.sectionRanges.find(range => range.id === activeSection.id)?.startTime ?? 0;
  const timingSong = useMemo(() => musicMode === 'continuous'
    ? continuousTimingSong(activeSection, continuousSong, activeStart) : sectionTimingSong(activeSection),
    [musicMode, activeSection, continuousSong, activeStart]);
  const timeline = useMemo(() => buildSectionTimeline(activeSection, settings, timingSong), [activeSection, settings, timingSong]);
  const project: ProjectConfig = useMemo(() => ({ ...settings, ...composition, sections,
    song: musicMode === 'continuous' ? continuousSong : sections.find(section => section.song)?.song ?? null,
    coverSettings: { titleCover: { enabled: false, duration: 3 }, endingCover: { enabled: false, duration: 3.5 } },
  }), [settings, composition, sections, musicMode, continuousSong]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSongLoaded = (loadedSong: SongData) => {
    if (musicMode === 'continuous') setDraftSong(loadedSong);
    else updateSection({ song: loadedSong });
    if (loadedSong.audioBuffer !== (musicMode === 'continuous' ? draftSong : song)?.audioBuffer) {
      setPreset(loadedSong.detectedPreset);
      saveSettings({ lastPreset: loadedSong.detectedPreset });
    }
  };

  const openSectionEditor = () => {
    if (musicMode === 'continuous') {
      if (!draftSong) return;
      setContinuousSong(draftSong);
    }
    setCurrentStep(2);
  };

  const handleSaveProject = async () => {
    if (projectBusy || mediaTasks > 0) return;
    setProjectBusy('素材と設定をこのブラウザに保存中…');
    try {
      const date = await saveProject({ settings: { seed, aspectRatio, videoQuality, preset, transitionStyle, fadeIn, fadeInDuration, fadeOut, fadeOutDuration },
        sections, continuousSong, draftSong, musicMode, continuousVolume, activeId: activeSection.id, currentStep });
      setSavedAt(date); addToast('success', '編集状態を保存しました', '写真・動画・音楽を含めて、このブラウザで再開できます。');
    } catch (error) { addToast('error', '保存できませんでした', String(error)); }
    finally { setProjectBusy(''); }
  };
  const handleRestoreProject = async () => {
    if (projectBusy || mediaTasks > 0 || !confirm('現在の編集内容を、保存した状態で置き換えますか？')) return;
    setProjectBusy('保存した状態を読み込み中…');
    try {
      const restored = await restoreProject(setProjectBusy);
      setSections(restored.sections); setContinuousSong(restored.continuousSong); setDraftSong(restored.draftSong);
      setMusicMode(restored.musicMode); setContinuousVolume(restored.continuousVolume); setActiveId(restored.activeId);
      setCurrentStep(restored.currentStep);
      const config = restored.settings;
      setSeed(config.seed); setAspectRatio(config.aspectRatio); setVideoQuality(config.videoQuality); setPreset(config.preset);
      setTransitionStyle(config.transitionStyle); setFadeIn(config.fadeIn); setFadeInDuration(config.fadeInDuration);
      setFadeOut(config.fadeOut); setFadeOutDuration(config.fadeOutDuration);
      addToast('success', '保存した編集状態を復元しました');
    } catch (error) { addToast('error', '復元できませんでした', String(error)); }
    finally { setProjectBusy(''); }
  };

  const handlePresetChange = (newPreset: PresetType) => {
    setPreset(newPreset);
    saveSettings({ lastPreset: newPreset });
  };

  const handleTransitionStyleChange = (newStyle: TransitionStyle) => {
    setTransitionStyle(newStyle);
    saveSettings({ lastTransitionStyle: newStyle });
  };

  const handleVideoQualityChange = (newQuality: VideoQuality) => {
    setVideoQuality(newQuality);
    saveSettings({ lastVideoQuality: newQuality });
  };

  const handleFadeChange = (opts: {
    fadeIn?: boolean;
    fadeInDuration?: number;
    fadeOut?: boolean;
    fadeOutDuration?: number;
  }) => {
    if (opts.fadeIn !== undefined) setFadeIn(opts.fadeIn);
    if (opts.fadeInDuration !== undefined) setFadeInDuration(opts.fadeInDuration);
    if (opts.fadeOut !== undefined) setFadeOut(opts.fadeOut);
    if (opts.fadeOutDuration !== undefined) setFadeOutDuration(opts.fadeOutDuration);
    saveSettings(opts);
  };

  const handleAspectChange = (newAspect: AspectRatio) => {
    setAspectRatio(newAspect);
    saveSettings({ aspect: newAspect });
  };

  const handleReset = () => {
    if (confirm('現在のプロジェクトをリセットして最初からやり直しますか？')) {
      setSections([{ ...createSection(1), durationMode: 'auto' }]);
      setActiveId('');
      setMusicMode('continuous'); setContinuousSong(null); setDraftSong(null); setContinuousVolume(1);
      setSeed(Math.floor(Math.random() * 1_000_000));
      setCurrentStep(1);
    }
  };

  const handleStartExport = () => {
    if (exportController || !project.timeline || !project.photos.length) return;
    if (project.timeline.isExceeded) {
      addToast('error', 'セクションの設定を確認してください', project.timeline.messages.map(m => `${m.title}: ${m.text}`).join('\n'));
      return;
    }

    const { promise, controller } = exportToMp4(project, (prog) => {
      setExportProgress({ ...prog });
    });

    setExportController(controller);

    promise
      .then(() => {
        addToast('success', '動画の書き出し完了', 'MP4ムービーが正常に生成されました。');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.includes('キャンセル')) {
          addToast('info', '書き出し中止', 'MP4書き出しをキャンセルしました。');
        } else {
          console.error('Export error:', err);
          const msg = err instanceof Error ? err.message : String(err);
          addToast('error', '書き出しエラー', msg);
        }
      }).finally(() => setExportController(null));
  };

  const handleCancelExport = () => {
    exportController?.cancel();
  };

  const hasPhotosOrCover = project.photos.length > 0;
  const previewError = useCallback((title: string, message: string, detail?: string) => addToast('error', title, message, detail), [addToast]);


  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1C1917] flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Capability Warning Banner */}
      <BrowserBanner status={capability} />

      {/* Top Header */}
      <Header
        currentStep={currentStep}
        onStepClick={(step) => { if (step === 2) { openSectionEditor(); return; } if (step === 3 && musicMode === 'continuous' && !musicConfirmed) return; setCurrentStep(step); }}
        hasSong={musicMode !== 'continuous' || !!draftSong}
        hasPhotos={hasPhotosOrCover && (musicMode !== 'continuous' || musicConfirmed)}
        onReset={handleReset}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex flex-wrap gap-3 items-center text-xs">
          <button disabled={!!projectBusy || !!exportController || mediaTasks > 0} onClick={() => void handleSaveProject()} className="px-4 py-2 border border-stone-300 bg-white rounded-xl font-semibold">編集状態を保存</button>
          <button disabled={!!projectBusy || !!exportController || mediaTasks > 0 || !savedAt} onClick={() => void handleRestoreProject()} className="px-4 py-2 border border-stone-300 bg-white rounded-xl font-semibold disabled:opacity-40">保存した状態を復元</button>
          <span className="text-stone-500">{savedAt ? `最終保存：${new Date(savedAt).toLocaleString('ja-JP')}` : '未保存'} / このブラウザに1件保存（次回保存で上書き）</span>
        </div>
        {projectBusy && <div role="status" className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6"><p className="bg-white rounded-2xl p-6">{projectBusy}</p></div>}

        {currentStep !== 3 && <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-6" aria-label="楽曲の使い方">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <h2 className="font-bold mb-3">楽曲の使い方</h2>
            <div className="flex flex-wrap gap-3">
              {(['sections', 'continuous'] as const).map(mode => <button key={mode} aria-pressed={musicMode === mode}
                className={`px-4 py-2 rounded-xl text-sm border ${musicMode === mode ? 'bg-stone-900 text-white' : 'bg-white text-stone-700'}`}
                onClick={() => {
                  if (mode === musicMode) return;
                  if (mode === 'continuous') {
                    setDraftSong(previous => previous ?? continuousSong ?? song ?? sections.find(section => section.song)?.song ?? null);
                    setSections(previous => previous.map(section => section.durationMode === 'custom' ? section : { ...section, durationMode: 'auto' }));
                  }
                  if (mode === 'sections') setSections(previous => previous.map(section => section.durationMode === 'auto' ? { ...section, duration: durationPlan.sections.find(item => item.id === section.id)?.duration ?? section.duration, durationMode: section.song ? 'music' : 'custom' } : section));
                  setMusicMode(mode);
                  setCurrentStep(1);
                }}>{mode === 'sections' ? 'セクションごとに設定' : '1曲を全体で通して使う'}</button>)}
            </div>
            {musicMode === 'continuous' && <div className="text-sm text-stone-600 mt-3 space-y-2">
              <p>セクションの境目でも曲は止まらず、続きから再生します。楽曲の選択・トリミングはステップ1、作品の冒頭・末尾のフェードはステップ3で設定できます。</p>
              <p className="break-all">全体のBGMファイル：{displayedSong?.file.name ?? '未選択（まず音楽を読み込んでください）'}</p>
              {displayedSong && <p>楽曲の使用時間：{(displayedSong.trimEnd - displayedSong.trimStart).toFixed(2)}秒{currentStep === 1 && !musicConfirmed ? '（編集中・未確定）' : '（確定済み）'}</p>}
              {currentStep === 1 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm">{draftSong ? '使用範囲を確認したら、ここからセクションの追加・時間設定へ進めます。上部の「セクション構成」も同じ操作です。' : 'まず下で音楽を読み込んでください。読み込み後にセクションを設定できます。'}</p>
                <button disabled={!draftSong} onClick={openSectionEditor} className="mt-3 px-4 py-2 bg-stone-900 text-white rounded-xl font-semibold disabled:opacity-40">
                  {musicConfirmed ? 'セクション設定へ戻る' : '楽曲の尺を確定してセクション設定へ'}
                </button>
              </div>}
              <label className="flex items-center gap-3">BGM音量 <input aria-label="全体のBGM音量" type="range" min="0" max="100" value={Math.round(continuousVolume * 100)} onChange={e => setContinuousVolume(Number(e.target.value) / 100)} />{Math.round(continuousVolume * 100)}%</label>
              {draftSong && <>
                <button onClick={() => { setDraftSong(null); setContinuousSong(null); setCurrentStep(1); }} className="underline">全体の楽曲の選択を解除</button>
              </>}
            </div>}
          </div>
        </section>}
        {(currentStep === 2 || (currentStep === 1 && musicMode === 'sections')) && <SectionEditor durationPlan={durationPlan} continuous={musicMode === 'continuous'} sections={sections} activeId={activeSection.id} ranges={composition.sectionRanges}
          onSelect={setActiveId} onUpdate={updateSection}
          onAdd={() => { const section = createSection(sections.length + 1); if (musicMode === 'continuous') section.durationMode = 'auto'; setSections(previous => [...previous, section]); setActiveId(section.id); }}
          onMove={(id, delta) => setSections(previous => {
            const from = previous.findIndex(section => section.id === id);
            const to = from + delta;
            if (from < 0 || to < 0 || to >= previous.length) return previous;
            const result = [...previous]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
          })}
          onDelete={id => { if (sections.length > 1 && confirm('このセクションと含まれる素材を削除しますか？')) setSections(previous => previous.filter(section => section.id !== id)); }} />}

        {currentStep === 1 && (
          <Step1Music key={musicMode === 'continuous' ? 'continuous' : activeSection.id}
            onMediaTask={onMediaTask}
            allowNoMusic={musicMode !== 'continuous'}
            title={musicMode === 'continuous' ? 'ステップ 1：音楽を選び、全体の尺を決める' : undefined}
            nextLabel={musicMode === 'continuous' ? 'この尺で確定してセクション構成へ' : undefined}
            durationNotice={musicMode === 'continuous' ? '開始・終了位置を調整し、「セクション構成」または確定ボタンで全体の尺を確定してください。確定するまで既存のセクションの時間は変更されません。手動指定は維持し、残り時間を自動のセクションへ再配分します。' : undefined}
            song={musicMode === 'continuous' ? draftSong : song}
            onSongLoaded={handleSongLoaded}
            onNext={openSectionEditor}
            onError={previewError}
          />
        )}

        {currentStep === 2 && (
          <Step2Photos key={activeSection.id}
            sectionId={activeSection.id}
            onMediaTask={onMediaTask}
            onEffectsApplied={() => handleTransitionStyleChange('dynamic')}
            song={timingSong}
            photos={photos}
            coverSettings={coverSettings}
            timeline={timeline}
            onPhotosChange={update => { const sectionId = activeSection.id; setSections(current => updateSectionPhotos(current, sectionId, update)); }}
            onCoverSettingsChange={coverSettings => updateSection({ coverSettings })}
            onPrev={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
            onNotify={(type, title, msg) => addToast(type, title, msg)}
            onError={previewError}
          />
        )}

        {currentStep === 3 && (
          <Step3Preview
            project={project}
            onPresetChange={handlePresetChange}
            onTransitionStyleChange={handleTransitionStyleChange}
            onVideoQualityChange={handleVideoQualityChange}
            onFadeChange={handleFadeChange}
            onAspectChange={handleAspectChange}
            onStartExport={handleStartExport}
            onPrev={() => setCurrentStep(2)}
            onError={previewError}
          />
        )}
      </main>

      {/* Export Modal */}
      {exportProgress && (
        <ExportModal
          progress={exportProgress}
          onCancel={handleCancelExport}
          onClose={() => { if (exportProgress.downloadUrl) URL.revokeObjectURL(exportProgress.downloadUrl); setExportProgress(null); }}
        />
      )}

      {/* Startup & In-App User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={handleCloseGuide}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
export default App;
