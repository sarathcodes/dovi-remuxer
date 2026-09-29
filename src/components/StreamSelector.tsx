import React from 'react';
import { Volume2, Subtitles, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AudioStream, SubtitleStream } from '../types/index';

interface StreamSelectorProps {
  audioStreams: AudioStream[];
  subtitleStreams: SubtitleStream[];
  selectedAudioIndices: number[];
  selectedSubtitleIndices: number[];
  onToggleAudio: (index: number) => void;
  onToggleSubtitle: (index: number) => void;
  onSelectAllAudio: () => void;
  onSelectAllSubtitles: () => void;
  onDeselectAllSubtitles: () => void;
}

export const StreamSelector: React.FC<StreamSelectorProps> = ({
  audioStreams,
  subtitleStreams,
  selectedAudioIndices,
  selectedSubtitleIndices,
  onToggleAudio,
  onToggleSubtitle,
  onSelectAllAudio,
  onSelectAllSubtitles,
  onDeselectAllSubtitles,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Audio Tracks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Audio Tracks ({selectedAudioIndices.length}/{audioStreams.length})
            </h3>
          </div>
          <button
            onClick={onSelectAllAudio}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition"
          >
            Select All
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Choose which audio tracks to include in the MP4 file.
        </p>

        <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
          {audioStreams.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-950/40 text-center text-xs text-slate-500">
              No audio tracks detected.
            </div>
          ) : (
            audioStreams.map((stream) => {
              const isSelected = selectedAudioIndices.includes(stream.index);
              const needsTranscode = stream.tv_compatibility === 'needs_transcode';

              return (
                <div
                  key={stream.index}
                  onClick={() => onToggleAudio(stream.index)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0 pointer-events-none"
                    />
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200 uppercase tracking-wide">
                          {stream.language || 'UND'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-mono text-slate-300">
                          {stream.codec_name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                          {stream.channel_layout}
                        </span>
                        {stream.is_default && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {stream.title}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {needsTranscode ? (
                      <span
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        title="Smart Transcode to E-AC-3 5.1/7.1 recommended for TV compatibility"
                      >
                        <AlertCircle className="w-3 h-3 mr-0.5" />
                        <span>Transcodes to E-AC-3</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                        <span>Direct Copy</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Subtitle Tracks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Subtitles className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Subtitles ({selectedSubtitleIndices.length}/{subtitleStreams.length})
            </h3>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={onSelectAllSubtitles}
              className="text-purple-400 hover:text-purple-300 font-medium transition"
            >
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={onDeselectAllSubtitles}
              className="text-slate-400 hover:text-slate-300 transition"
            >
              None
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Choose subtitle languages to extract and convert to MP4 Timed Text (mov_text) or external .srt.
        </p>

        <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
          {subtitleStreams.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-950/40 text-center text-xs text-slate-500">
              No embedded subtitles detected in this file.
            </div>
          ) : (
            subtitleStreams.map((sub) => {
              const isSelected = selectedSubtitleIndices.includes(sub.index);
              const isBitmap = sub.type === 'bitmap';

              return (
                <div
                  key={sub.index}
                  onClick={() => onToggleSubtitle(sub.index)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-950/20 border-purple-500/40 text-slate-100'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-purple-500 bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0 pointer-events-none"
                    />
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200 uppercase tracking-wide">
                          {sub.language || 'UND'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-mono text-slate-300">
                          {sub.codec_name}
                        </span>
                        {sub.is_forced && (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                            Forced
                          </span>
                        )}
                        {sub.is_default && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {sub.title}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isBitmap ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        title="Blu-ray PGS bitmaps cannot be embedded as MP4 text; export external .srt or OCR"
                      >
                        PGS Bitmap
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        mov_text / srt
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
