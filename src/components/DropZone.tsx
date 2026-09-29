import React, { useState, useCallback } from 'react';
import { UploadCloud, FileVideo, RefreshCw } from 'lucide-react';
import { clientApi } from '../api';
import type { MediaProbeResult } from '../types/index';

interface DropZoneProps {
  mediaInfo: MediaProbeResult | null;
  isLoading: boolean;
  onFileSelected: (filePath: string) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ mediaInfo, isLoading, onFileSelected }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        // Electron injects path into File object
        const filePath = (file as any).path || file.name;
        if (filePath) {
          onFileSelected(filePath);
        }
      }
    },
    [onFileSelected]
  );

  const handleBrowse = async () => {
    const selected = await clientApi.selectFile();
    if (selected) {
      onFileSelected(selected);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (mediaInfo) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <FileVideo className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-slate-100 truncate">{mediaInfo.fileName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {formatFileSize(mediaInfo.fileSize)}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate" title={mediaInfo.filePath}>
              {mediaInfo.filePath}
            </p>
          </div>
        </div>

        <button
          onClick={handleBrowse}
          className="ml-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center space-x-1.5 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Change File</span>
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowse}
      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
        isDragOver
          ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
      }`}
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform ${
          isDragOver ? 'bg-purple-600/20 scale-110 text-purple-400' : 'bg-slate-800/80 text-slate-400'
        }`}
      >
        {isLoading ? (
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
        ) : (
          <UploadCloud className="w-8 h-8" />
        )}
      </div>

      <h3 className="text-base font-semibold text-slate-200 mb-1">
        {isLoading ? 'Probing MKV Video Details...' : 'Drag and drop your 4K DoVi MKV file here'}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mb-4">
        Supports Dolby Vision Profile 5, Profile 7 (Blu-ray), and Profile 8.1 files with TrueHD Atmos, E-AC-3, and subtitles.
      </p>

      <button
        type="button"
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          handleBrowse();
        }}
        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition"
      >
        Browse MKV Video
      </button>
    </div>
  );
};
