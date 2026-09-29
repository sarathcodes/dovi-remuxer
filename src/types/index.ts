export interface VideoStream {
  index: number;
  codec_name: string;
  width: number;
  height: number;
  fps: string;
  pix_fmt: string;
  dovi_profile: number | null;
  dovi_compatibility_id: number | null;
  hdr_format: string;
  bitrate: string;
  duration: number;
}

export interface AudioStream {
  index: number;
  codec_name: string;
  language: string;
  title: string;
  channels: number;
  channel_layout: string;
  bitrate: string;
  sample_rate: string;
  is_default: boolean;
  is_forced: boolean;
  tv_compatibility: 'native' | 'needs_transcode';
}

export interface SubtitleStream {
  index: number;
  codec_name: string;
  language: string;
  title: string;
  is_default: boolean;
  is_forced: boolean;
  type: 'text' | 'bitmap';
}

export interface MediaProbeResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  duration: number;
  videoStreams: VideoStream[];
  audioStreams: AudioStream[];
  subtitleStreams: SubtitleStream[];
  doviProfileDetected: number | null;
}

export interface RemuxOptions {
  inputPath: string;
  outputPath: string;
  selectedAudioIndices: number[];
  selectedSubtitleIndices: number[];
  audioMode: 'smart' | 'copy' | 'force_eac3';
  audioBitrate: string;
  targetDvProfile: 'auto' | 'profile8' | 'profile5' | 'copy';
  muxerEngine: 'hybrid' | 'mp4muxer' | 'ffmpeg';
  embedSubtitles: boolean;
  exportExternalSrt: boolean;
}

export interface ConversionProgress {
  stage: 'probing' | 'extracting_video' | 'processing_audio' | 'processing_subtitles' | 'muxing' | 'completed' | 'error';
  stageDescription: string;
  percentage: number;
  speed?: string;
  logLine?: string;
  error?: string;
}

export interface BinaryStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  mp4muxer: boolean;
  mp4box: boolean;
  ffmpegPath: string;
  ffprobePath: string;
  mp4muxerPath: string;
  mp4boxPath: string;
}

export interface IElectronAPI {
  probeMedia: (filePath: string) => Promise<MediaProbeResult>;
  startRemux: (options: RemuxOptions) => Promise<{ success: boolean; outputPath: string }>;
  cancelRemux: () => Promise<void>;
  onProgress: (callback: (progress: ConversionProgress) => void) => () => void;
  onLog: (callback: (log: string) => void) => () => void;
  checkBinaries: () => Promise<BinaryStatus>;
  setBinaryPaths: (paths: Partial<BinaryStatus>) => Promise<BinaryStatus>;
  selectFolder: () => Promise<string | null>;
  selectFile: () => Promise<string | null>;
  showInFolder: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
