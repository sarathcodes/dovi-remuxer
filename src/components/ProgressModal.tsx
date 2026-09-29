import React, { useRef, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, FolderOpen, Terminal, X } from 'lucide-react';
import type { ConversionProgress } from '../types/index';

interface ProgressModalProps {
  isOpen: boolean;
  progress: ConversionProgress | null;
  logs: string[];
  outputPath: string;
  onCancel: () => void;
  onClose: () => void;
  onShowInFolder: (path: string) => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  progress,
  logs,
  outputPath,
  onCancel,
  onClose,
  onShowInFolder,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const isCompleted = progress?.stage === 'completed';
  const isError = progress?.stage === 'error';
  const isRunning = !isCompleted && !isError;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            {isRunning && (
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            )}
            {isCompleted && (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            )}
            {isError && (
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isCompleted
                  ? 'Remux Completed Successfully'
                  : isError
                  ? 'Conversion Failed'
                  : 'Converting to Dolby Vision MP4...'}
              </h3>
              <p className="text-xs text-slate-400">
                {progress?.stageDescription || 'Processing media streams...'}
              </p>
            </div>
          </div>

          {!isRunning && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="my-5">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-300 font-medium capitalize">
              {progress?.stage?.replace('_', ' ') || 'Starting'}
            </span>
            <div className="flex items-center space-x-2">
              {progress?.speed && (
                <span className="text-slate-400 font-mono">Speed: {progress.speed}</span>
              )}
              <span className="font-bold text-purple-400 font-mono">
                {progress?.percentage ?? 0}%
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isError
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-500'
              }`}
              style={{ width: `${progress?.percentage ?? 0}%` }}
            />
          </div>
        </div>

        {/* Live Terminal Log Viewer */}
        <div className="flex-1 flex flex-col min-h-48 overflow-hidden bg-slate-950 rounded-xl border border-slate-800/90 p-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500 pb-2 border-b border-slate-900 mb-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>Process Logs (FFmpeg & mp4muxer output)</span>
          </div>

          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1 select-text"
          >
            {logs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-5 mt-auto flex justify-between items-center border-t border-slate-800">
          <div>
            {isCompleted && (
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready for TV playback!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isRunning && (
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-slate-700 transition"
              >
                Cancel Conversion
              </button>
            )}

            {isCompleted && (
              <button
                onClick={() => onShowInFolder(outputPath)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Show in Folder</span>
              </button>
            )}

            {!isRunning && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
