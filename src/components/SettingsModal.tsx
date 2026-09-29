import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Save } from 'lucide-react';
import { clientApi } from '../api';
import type { BinaryStatus } from '../types/index';

interface SettingsModalProps {
  isOpen: boolean;
  binaries: BinaryStatus | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  binaries,
  onClose,
  onRefresh,
}) => {
  const [paths, setPaths] = useState<Partial<BinaryStatus>>({
    ffmpegPath: '',
    ffprobePath: '',
    mp4muxerPath: '',
    mp4boxPath: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (binaries) {
      setPaths({
        ffmpegPath: binaries.ffmpegPath || '',
        ffprobePath: binaries.ffprobePath || '',
        mp4muxerPath: binaries.mp4muxerPath || '',
        mp4boxPath: binaries.mp4boxPath || '',
      });
    }
  }, [binaries]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await clientApi.setBinaryPaths(paths);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative flex flex-col space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100">Tool & Binary Configuration</h3>
            <p className="text-xs text-slate-400">
              Configure underlying command-line utilities used for Dolby Vision processing.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* FFmpeg */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <span>FFmpeg Executable</span>
                {binaries?.ffmpeg ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Detected</span>
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Missing</span>
                  </span>
                )}
              </span>
            </div>
            <input
              type="text"
              value={paths.ffmpegPath}
              onChange={(e) => setPaths({ ...paths, ffmpegPath: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
              placeholder="e.g. /opt/homebrew/bin/ffmpeg or C:\ffmpeg\ffmpeg.exe"
            />
          </div>

          {/* FFprobe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <span>FFprobe Executable</span>
                {binaries?.ffprobe ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Detected</span>
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Missing</span>
                  </span>
                )}
              </span>
            </div>
            <input
              type="text"
              value={paths.ffprobePath}
              onChange={(e) => setPaths({ ...paths, ffprobePath: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
              placeholder="e.g. /opt/homebrew/bin/ffprobe or C:\ffmpeg\ffprobe.exe"
            />
          </div>

          {/* mp4muxer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <span>Dolby mp4muxer (Optional CLI)</span>
                {binaries?.mp4muxer ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Detected</span>
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Optional (FFmpeg fallback active)</span>
                  </span>
                )}
              </span>
            </div>
            <input
              type="text"
              value={paths.mp4muxerPath}
              onChange={(e) => setPaths({ ...paths, mp4muxerPath: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
              placeholder="e.g. /usr/local/bin/mp4muxer or C:\tools\mp4muxer.exe"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Dolby's official streaming MP4 multiplexer. If not installed, the app seamlessly uses FFmpeg's built-in Dolby Vision container engine.
            </p>
          </div>

          {/* Quick installation tips */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-[11px]">
            <span className="font-semibold text-slate-300 flex items-center space-x-1">
              <ExternalLink className="w-3 h-3 text-purple-400" />
              <span>How to get these tools:</span>
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-300">macOS:</strong> Run <code className="text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded">brew install ffmpeg</code> in your terminal.
              </li>
              <li>
                <strong className="text-slate-300">Windows:</strong> Install with Scoop (<code className="text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded">scoop install ffmpeg</code>) or Chocolatey (<code className="text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded">choco install ffmpeg</code>).
              </li>
              <li>
                <strong className="text-slate-300">Linux:</strong> Run <code className="text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded">sudo apt install ffmpeg</code>.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-detect Tools</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              Close
            </button>
            <button
              disabled={isSaving}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Paths'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
