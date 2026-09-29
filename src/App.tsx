import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { MediaInspector } from './components/MediaInspector';
import { StreamSelector } from './components/StreamSelector';
import { ConversionSettings } from './components/ConversionSettings';
import { ProgressModal } from './components/ProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { clientApi } from './api';
import type { MediaProbeResult, RemuxOptions, BinaryStatus, ConversionProgress } from './types/index';

export default function App() {
  const [binaries, setBinaries] = useState<BinaryStatus | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaProbeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [options, setOptions] = useState<RemuxOptions>({
    inputPath: '',
    outputPath: '',
    selectedAudioIndices: [],
    selectedSubtitleIndices: [],
    audioMode: 'smart',
    audioBitrate: '640k',
    targetDvProfile: 'auto',
    muxerEngine: 'hybrid',
    embedSubtitles: true,
    exportExternalSrt: true,
    doviTag: 'dvh1',
  });

  const checkTools = useCallback(async () => {
    try {
      const status = await clientApi.checkBinaries();
      setBinaries(status);
    } catch (e) {
      console.error('Failed to check binaries:', e);
    }
  }, []);

  useEffect(() => {
    checkTools();

    // Listen to progress updates
    const unsubProgress = clientApi.onProgress((p) => {
      setProgress(p);
    });
    const unsubLog = clientApi.onLog((log) => {
      setLogs((prev) => [...prev.slice(-300), log]);
    });

    return () => {
      unsubProgress();
      unsubLog();
    };
  }, [checkTools]);

  const handleFileSelected = async (filePath: string) => {
    setIsLoading(true);
    try {
      const probed = await clientApi.probeMedia(filePath);
      setMediaInfo(probed);

      // Derive default output path (.mp4)
      const defaultOutput = filePath.replace(/\.[^/.]+$/, '') + '.dovi.mp4';

      // Auto-select audio tracks: default track or first audio track
      const defaultAudio = probed.audioStreams.filter((a) => a.is_default);
      const selectedAudio = defaultAudio.length > 0
        ? defaultAudio.map((a) => a.index)
        : probed.audioStreams.length > 0
        ? [probed.audioStreams[0].index]
        : [];

      // Auto-select text subtitles
      const defaultSubs = probed.subtitleStreams
        .filter((s) => s.type === 'text' && (s.is_default || s.is_forced))
        .map((s) => s.index);

      setOptions((prev) => ({
        ...prev,
        inputPath: filePath,
        outputPath: defaultOutput,
        selectedAudioIndices: selectedAudio,
        selectedSubtitleIndices: defaultSubs,
        targetDvProfile: probed.doviProfileDetected === 5 ? 'profile5' : 'profile8',
      }));
    } catch (err: any) {
      alert(`Error analyzing MKV video:\n${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAudio = (index: number) => {
    setOptions((prev) => {
      const exists = prev.selectedAudioIndices.includes(index);
      return {
        ...prev,
        selectedAudioIndices: exists
          ? prev.selectedAudioIndices.filter((i) => i !== index)
          : [...prev.selectedAudioIndices, index],
      };
    });
  };

  const handleToggleSubtitle = (index: number) => {
    setOptions((prev) => {
      const exists = prev.selectedSubtitleIndices.includes(index);
      return {
        ...prev,
        selectedSubtitleIndices: exists
          ? prev.selectedSubtitleIndices.filter((i) => i !== index)
          : [...prev.selectedSubtitleIndices, index],
      };
    });
  };

  const handleSelectAllAudio = () => {
    if (mediaInfo) {
      setOptions((prev) => ({
        ...prev,
        selectedAudioIndices: mediaInfo.audioStreams.map((a) => a.index),
      }));
    }
  };

  const handleSelectAllSubtitles = () => {
    if (mediaInfo) {
      setOptions((prev) => ({
        ...prev,
        selectedSubtitleIndices: mediaInfo.subtitleStreams.map((s) => s.index),
      }));
    }
  };

  const handleDeselectAllSubtitles = () => {
    setOptions((prev) => ({
      ...prev,
      selectedSubtitleIndices: [],
    }));
  };

  const handleSelectOutputFolder = async () => {
    const folder = await clientApi.selectFolder();
    if (folder && mediaInfo) {
      const baseName = mediaInfo.fileName.replace(/\.[^/.]+$/, '');
      setOptions((prev) => ({
        ...prev,
        outputPath: `${folder}/${baseName}.dovi.mp4`,
      }));
    }
  };

  const handleStartRemux = async () => {
    if (!options.inputPath || !options.outputPath) return;
    setLogs([]);
    setProgress({
      stage: 'probing',
      stageDescription: 'Initializing conversion pipeline...',
      percentage: 0,
    });
    setIsProgressModalOpen(true);

    try {
      await clientApi.startRemux(options);
    } catch (err: any) {
      console.error('Remux failed:', err);
    }
  };

  const handleCancelRemux = async () => {
    await clientApi.cancelRemux();
  };

  const handleShowInFolder = async (pathToShow: string) => {
    await clientApi.showInFolder(pathToShow);
  };

  const canStart = Boolean(
    mediaInfo &&
    options.inputPath &&
    options.outputPath &&
    options.selectedAudioIndices.length > 0 &&
    binaries?.ffmpeg
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        binaries={binaries}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Drag and Drop Zone */}
        <DropZone
          mediaInfo={mediaInfo}
          isLoading={isLoading}
          onFileSelected={handleFileSelected}
        />

        {mediaInfo && (
          <>
            {/* Video & Dolby Vision Information */}
            <MediaInspector
              videoStream={mediaInfo.videoStreams[0] || null}
              totalDuration={mediaInfo.duration}
            />

            {/* Audio and Subtitle Track Selection */}
            <StreamSelector
              audioStreams={mediaInfo.audioStreams}
              subtitleStreams={mediaInfo.subtitleStreams}
              selectedAudioIndices={options.selectedAudioIndices}
              selectedSubtitleIndices={options.selectedSubtitleIndices}
              onToggleAudio={handleToggleAudio}
              onToggleSubtitle={handleToggleSubtitle}
              onSelectAllAudio={handleSelectAllAudio}
              onSelectAllSubtitles={handleSelectAllSubtitles}
              onDeselectAllSubtitles={handleDeselectAllSubtitles}
            />

            {/* Remux & Compatibility Settings */}
            <ConversionSettings
              options={options}
              onChangeOptions={setOptions}
              onSelectOutputFolder={handleSelectOutputFolder}
              onStartRemux={handleStartRemux}
              canStart={canStart}
            />
          </>
        )}
      </main>

      {/* Progress & Log Modal */}
      <ProgressModal
        isOpen={isProgressModalOpen}
        progress={progress}
        logs={logs}
        outputPath={options.outputPath}
        onCancel={handleCancelRemux}
        onClose={() => setIsProgressModalOpen(false)}
        onShowInFolder={handleShowInFolder}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        binaries={binaries}
        onClose={() => setIsSettingsOpen(false)}
        onRefresh={checkTools}
      />
    </div>
  );
}
