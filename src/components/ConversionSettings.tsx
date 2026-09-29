import React from 'react';
import { Sliders, FolderOpen, Play, Check, HelpCircle } from 'lucide-react';
import type { RemuxOptions } from '../types/index';

interface ConversionSettingsProps {
  options: RemuxOptions;
  onChangeOptions: (updater: (prev: RemuxOptions) => RemuxOptions) => void;
  onSelectOutputFolder: () => void;
  onStartRemux: () => void;
  canStart: boolean;
}

export const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  options,
  onChangeOptions,
  onSelectOutputFolder,
  onStartRemux,
  canStart,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-200">Remux & TV Compatibility Settings</h3>
        </div>
        <span className="text-xs text-slate-400">Configured for standard TV USB/DLNA playback</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Dolby Vision Profile */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center justify-between">
            <span>Dolby Vision Profile</span>
            <span
              className="text-slate-500 cursor-help"
              title="LG TVs and Sony Android TVs natively play Profile 8.1 in MP4 container."
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </label>
          <select
            value={options.targetDvProfile}
            onChange={(e) =>
              onChangeOptions((prev) => ({
                ...prev,
                targetDvProfile: e.target.value as any,
              }))
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="auto">Auto-Detect (Source)</option>
            <option value="profile8">Profile 8.1 (HDR10 Base)</option>
            <option value="profile5">Profile 5 (Streaming)</option>
            <option value="copy">Direct Pass-Through</option>
          </select>
        </div>

        {/* Dolby Vision FourCC Tag */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center justify-between">
            <span>Dolby Vision Tag</span>
            <span
              className="text-slate-500 cursor-help"
              title="dvh1 triggers Dolby Vision on LG OLED (webOS), Sony Bravia, and Apple TV. hvc1 falls back to standard HDR10."
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </label>
          <select
            value={options.doviTag || 'dvh1'}
            onChange={(e) =>
              onChangeOptions((prev) => ({
                ...prev,
                doviTag: e.target.value as any,
              }))
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
          >
            <option value="dvh1">dvh1 (LG OLED / Sony TV / Apple TV)</option>
            <option value="dvhe">dvhe (Legacy Dolby Vision)</option>
            <option value="hvc1">hvc1 (Standard HDR10 fallback)</option>
          </select>
        </div>

        {/* Muxing Engine */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">Muxing Engine</label>
          <select
            value={options.muxerEngine}
            onChange={(e) =>
              onChangeOptions((prev) => ({
                ...prev,
                muxerEngine: e.target.value as any,
              }))
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="hybrid">Hybrid (Dolby mp4muxer + FFmpeg fallback)</option>
            <option value="ffmpeg">FFmpeg Direct (Fastest single-pass)</option>
            <option value="mp4muxer">Dolby mp4muxer CLI (Strict Dolby Container)</option>
          </select>
        </div>

        {/* Audio Mode */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5 flex items-center justify-between">
            <span>Audio Handling</span>
            <span
              className="text-slate-500 cursor-help"
              title="Smart Mode keeps EAC3/AC3 intact and transcodes TrueHD Atmos/DTS to EAC3 5.1/7.1 to prevent 'Unsupported Audio' on TVs."
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          </label>
          <select
            value={options.audioMode}
            onChange={(e) =>
              onChangeOptions((prev) => ({
                ...prev,
                audioMode: e.target.value as any,
              }))
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
          >
            <option value="smart">Smart TV Mode (Transcode TrueHD/DTS to E-AC-3)</option>
            <option value="copy">Direct Copy Only (Pass-through)</option>
            <option value="force_eac3">Force All Tracks to E-AC-3 640k</option>
          </select>
        </div>
      </div>

      {/* Subtitles & Output Destination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-800/80">
        {/* Subtitle Checkboxes */}
        <div className="space-y-2">
          <span className="block text-slate-400 font-medium mb-1">Subtitle Options</span>
          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.embedSubtitles}
              onChange={(e) =>
                onChangeOptions((prev) => ({
                  ...prev,
                  embedSubtitles: e.target.checked,
                }))
              }
              className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700 focus:ring-0"
            />
            <span>Embed text subtitles in MP4 container (mov_text)</span>
          </label>

          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={options.exportExternalSrt}
              onChange={(e) =>
                onChangeOptions((prev) => ({
                  ...prev,
                  exportExternalSrt: e.target.checked,
                }))
              }
              className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700 focus:ring-0"
            />
            <span>Export external .srt files alongside output MP4</span>
          </label>
        </div>

        {/* Output Path */}
        <div>
          <span className="block text-slate-400 font-medium mb-1">Output Destination</span>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={options.outputPath}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs truncate focus:outline-none"
              placeholder="Select output MP4 destination..."
            />
            <button
              onClick={onSelectOutputFolder}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center space-x-1 shrink-0"
              title="Select folder"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="pt-2 flex justify-end">
        <button
          disabled={!canStart}
          onClick={onStartRemux}
          className={`px-6 py-3 rounded-xl font-semibold text-sm flex items-center space-x-2 shadow-lg transition ${
            canStart
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Convert to Dolby Vision MP4</span>
        </button>
      </div>
    </div>
  );
};
