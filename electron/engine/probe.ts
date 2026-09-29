import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { promisify } from 'node:util';
import type { MediaProbeResult, VideoStream, AudioStream, SubtitleStream } from '../../src/types/index';
import { checkAllBinaries } from './binaries';

const execFileAsync = promisify(execFile);

export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const binaries = checkAllBinaries();
  const ffprobePath = binaries.ffprobe ? binaries.ffprobePath : 'ffprobe';

  // Run ffprobe with JSON output
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  let stdout = '';
  try {
    const res = await execFileAsync(ffprobePath, args, {
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
      },
    });
    stdout = res.stdout;
  } catch (err: any) {
    throw new Error(`Failed to probe media file with ffprobe: ${err.message || err}`);
  }

  const data = JSON.parse(stdout);
  const streams = data.streams || [];
  const format = data.format || {};

  const fileStats = fs.statSync(filePath);
  const duration = parseFloat(format.duration || '0');
  const fileName = path.basename(filePath);

  const videoStreams: VideoStream[] = [];
  const audioStreams: AudioStream[] = [];
  const subtitleStreams: SubtitleStream[] = [];
  let doviProfileDetected: number | null = null;

  for (const stream of streams) {
    const codecType = stream.codec_type;
    const codecName = (stream.codec_name || '').toLowerCase();
    const tags = stream.tags || {};
    const disposition = stream.disposition || {};

    if (codecType === 'video') {
      // Analyze Dolby Vision metadata
      let dvProfile: number | null = null;
      let dvCompatId: number | null = null;
      let hdrFormat = 'SDR';

      // Check side data for DOVI configuration record
      if (Array.isArray(stream.side_data_list)) {
        for (const sideData of stream.side_data_list) {
          const type = (sideData.side_data_type || '').toLowerCase();
          if (type.includes('dovi') || type.includes('dolby vision')) {
            if (typeof sideData.dv_profile === 'number') {
              dvProfile = sideData.dv_profile;
              doviProfileDetected = dvProfile;
            }
            if (typeof sideData.dv_bl_signal_compatibility_id === 'number') {
              dvCompatId = sideData.dv_bl_signal_compatibility_id;
            }
          }
        }
      }

      // Check color primaries / transfer for HDR10
      const colorTransfer = (stream.color_transfer || '').toLowerCase();
      const colorPrimaries = (stream.color_primaries || '').toLowerCase();
      const isHDR = colorTransfer.includes('smpte2084') || colorTransfer.includes('arib-std-b67') || colorPrimaries.includes('bt2020');

      if (dvProfile !== null) {
        if (dvProfile === 5) {
          hdrFormat = 'Dolby Vision Profile 5 (Streaming IPTPQc2)';
        } else if (dvProfile === 8) {
          hdrFormat = `Dolby Vision Profile 8.${dvCompatId ?? 1} (HDR10 Base)`;
        } else if (dvProfile === 7) {
          hdrFormat = 'Dolby Vision Profile 7 (Blu-ray UHD Dual Layer)';
        } else {
          hdrFormat = `Dolby Vision Profile ${dvProfile}`;
        }
      } else if (isHDR) {
        hdrFormat = colorTransfer.includes('arib-std-b67') ? 'HLG (HDR)' : 'HDR10';
      }

      // Parse frame rate
      let fps = '24';
      if (stream.r_frame_rate) {
        const parts = stream.r_frame_rate.split('/');
        if (parts.length === 2 && parseInt(parts[1], 10) > 0) {
          fps = (parseInt(parts[0], 10) / parseInt(parts[1], 10)).toFixed(3);
        } else {
          fps = stream.r_frame_rate;
        }
      }

      videoStreams.push({
        index: stream.index,
        codec_name: codecName,
        width: stream.width || 0,
        height: stream.height || 0,
        fps,
        pix_fmt: stream.pix_fmt || '',
        dovi_profile: dvProfile,
        dovi_compatibility_id: dvCompatId,
        hdr_format: hdrFormat,
        bitrate: stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate, 10) / 1000)} kbps` : 'Auto',
        duration: parseFloat(stream.duration || format.duration || '0'),
      });
    } else if (codecType === 'audio') {
      const language = tags.language || 'und';
      const title = tags.title || '';
      const channels = stream.channels || 2;
      const channelLayout = stream.channel_layout || (channels === 8 ? '7.1' : channels === 6 ? '5.1' : 'stereo');

      // Check TV compatibility:
      // TrueHD / Atmos in TrueHD and DTS-HD are NOT supported by most Smart TV internal players in MP4
      const isNeedsTranscode = codecName === 'truehd' || codecName.startsWith('dts');

      audioStreams.push({
        index: stream.index,
        codec_name: codecName,
        language,
        title: title || `${language.toUpperCase()} (${codecName.toUpperCase()} ${channelLayout})`,
        channels,
        channel_layout: channelLayout,
        bitrate: stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate, 10) / 1000)} kbps` : 'Unknown',
        sample_rate: stream.sample_rate ? `${stream.sample_rate} Hz` : '',
        is_default: disposition.default === 1,
        is_forced: disposition.forced === 1,
        tv_compatibility: isNeedsTranscode ? 'needs_transcode' : 'native',
      });
    } else if (codecType === 'subtitle') {
      const language = tags.language || 'und';
      const title = tags.title || '';
      const isBitmap = codecName.includes('pgs') || codecName.includes('dvd') || codecName.includes('dvb');

      subtitleStreams.push({
        index: stream.index,
        codec_name: codecName,
        language,
        title: title || `${language.toUpperCase()} (${isBitmap ? 'PGS Bitmap' : codecName.toUpperCase()})`,
        is_default: disposition.default === 1,
        is_forced: disposition.forced === 1,
        type: isBitmap ? 'bitmap' : 'text',
      });
    }
  }

  return {
    filePath,
    fileName,
    fileSize: fileStats.size,
    duration,
    videoStreams,
    audioStreams,
    subtitleStreams,
    doviProfileDetected,
  };
}
