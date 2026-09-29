import React from 'react';
import { Film, CheckCircle, Sparkles, Clock, Monitor } from 'lucide-react';
import type { VideoStream } from '../types/index';

interface MediaInspectorProps {
  videoStream: VideoStream | null;
  totalDuration: number;
}

export const MediaInspector: React.FC<MediaInspectorProps> = ({ videoStream, totalDuration }) => {
  if (!videoStream) return null;

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const is4K = videoStream.width >= 3800 || videoStream.height >= 2100;
  const isDoVi = videoStream.dovi_profile !== null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-200">Video & Dolby Vision Specifications</h3>
        </div>

        {isDoVi && (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1" />
            <span>Dolby Vision Profile {videoStream.dovi_profile} Detected</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Resolution */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3">
          <div className="text-slate-500 mb-1 flex items-center space-x-1">
            <Monitor className="w-3.5 h-3.5" />
            <span>Resolution</span>
          </div>
          <div className="font-semibold text-slate-200 text-sm flex items-center space-x-1.5">
            <span>{videoStream.width} × {videoStream.height}</span>
            {is4K && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                4K UHD
              </span>
            )}
          </div>
        </div>

        {/* Codec */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3">
          <div className="text-slate-500 mb-1">Video Codec</div>
          <div className="font-semibold text-slate-200 text-sm uppercase">
            {videoStream.codec_name} (10-bit HEVC)
          </div>
        </div>

        {/* Frame Rate & Bitrate */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3">
          <div className="text-slate-500 mb-1">FPS & Bitrate</div>
          <div className="font-semibold text-slate-200 text-sm">
            {videoStream.fps} fps • {videoStream.bitrate}
          </div>
        </div>

        {/* Runtime */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3">
          <div className="text-slate-500 mb-1 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Duration</span>
          </div>
          <div className="font-semibold text-slate-200 text-sm">
            {formatDuration(totalDuration || videoStream.duration)}
          </div>
        </div>
      </div>

      {/* HDR & Dolby Vision compatibility note */}
      <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start space-x-3 text-xs">
        <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle className="w-3.5 h-3.5" />
        </div>
        <div className="text-slate-300 leading-relaxed">
          <strong className="text-white">{videoStream.hdr_format}</strong>. When remuxed into an MP4 container,
          smart TVs (such as LG OLED webOS, Sony Bravia, and Apple TV) will recognize the dynamic Dolby Vision metadata and trigger native Dolby Vision Cinema / Bright picture modes.
        </div>
      </div>
    </div>
  );
};
