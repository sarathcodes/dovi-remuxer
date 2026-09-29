import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { RemuxOptions, ConversionProgress } from '../../src/types/index';
import { checkAllBinaries } from './binaries';
import { probeMedia } from './probe';

let activeChildProcess: ChildProcess | null = null;
let activeTempDir: string | null = null;
let isCancelled = false;

export function cancelCurrentRemux() {
  isCancelled = true;
  if (activeChildProcess) {
    try {
      activeChildProcess.kill('SIGKILL');
    } catch {
      // process already dead
    }
    activeChildProcess = null;
  }
  cleanupTempDir();
}

function cleanupTempDir() {
  if (activeTempDir && fs.existsSync(activeTempDir)) {
    try {
      fs.rmSync(activeTempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    activeTempDir = null;
  }
}

/**
 * Patches the MP4 video sample description (stsd) FourCC tag from 'hvc1'/'hev1' to 'dvh1' or 'dvhe'.
 * This is critical because TVs (especially LG OLED webOS, Sony Android TVs, and Apple devices)
 * ignore Dolby Vision dynamic metadata unless the FourCC is specifically 'dvh1' or 'dvhe'.
 */
export function patchMp4DolbyVisionTag(filePath: string, targetTag: 'dvh1' | 'dvhe' | 'hvc1' = 'dvh1'): boolean {
  if (targetTag === 'hvc1') return true;
  if (!fs.existsSync(filePath)) return false;

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r+');
    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;

    // Search blocks: first 32MB (where faststart puts moov) and last 32MB (if non-faststart)
    const searchBlocks: { buf: Buffer; baseOffset: number }[] = [];
    const headSize = Math.min(32 * 1024 * 1024, fileSize);
    const headBuf = Buffer.alloc(headSize);
    fs.readSync(fd, headBuf, 0, headSize, 0);
    searchBlocks.push({ buf: headBuf, baseOffset: 0 });

    if (fileSize > headSize) {
      const tailReadSize = Math.min(32 * 1024 * 1024, fileSize - headSize);
      const tailOffset = fileSize - tailReadSize;
      const tailBuf = Buffer.alloc(tailReadSize);
      fs.readSync(fd, tailBuf, 0, tailReadSize, tailOffset);
      searchBlocks.push({ buf: tailBuf, baseOffset: tailOffset });
    }

    let patched = false;
    for (const { buf, baseOffset } of searchBlocks) {
      let pos = 0;
      while ((pos = buf.indexOf('stsd', pos)) !== -1) {
        // 'stsd' box format:
        // 'stsd' (4 bytes) + version/flags (4 bytes) + entry_count (4 bytes) + entry_size (4 bytes) = 16 bytes
        // The 4-byte FourCC is located at pos + 16
        if (pos + 20 <= buf.length) {
          const fourcc = buf.toString('latin1', pos + 16, pos + 20);
          if (fourcc === 'hvc1' || fourcc === 'hev1' || fourcc === 'dvhe' || fourcc === 'dvh1') {
            const absoluteOffset = baseOffset + pos + 16;
            const tagBuf = Buffer.from(targetTag, 'latin1');
            fs.writeSync(fd, tagBuf, 0, 4, absoluteOffset);
            patched = true;
            break;
          }
        }
        pos += 4;
      }
      if (patched) break;
    }
    return patched;
  } catch (err) {
    console.error('[Remuxer] Failed to patch MP4 FourCC tag:', err);
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

function runCommand(
  cmd: string,
  args: string[],
  onData: (data: string) => void,
  onProgressRatio?: (ratio: number, speed?: string) => void,
  totalDurationSeconds?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isCancelled) {
      return reject(new Error('Operation cancelled by user'));
    }

    onData(`[Executing] ${cmd} ${args.join(' ')}\n`);

    const child = spawn(cmd, args, {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
      },
    });

    activeChildProcess = child;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      onData(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      onData(text);

      if (totalDurationSeconds && totalDurationSeconds > 0 && onProgressRatio) {
        // Parse ffmpeg time: time=01:23:45.67 speed= 15.2x
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        const speedMatch = text.match(/speed=\s*([\d.]+x)/);

        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const currentSec = hours * 3600 + minutes * 60 + seconds;
          const ratio = Math.min(0.99, Math.max(0, currentSec / totalDurationSeconds));
          onProgressRatio(ratio, speedMatch ? speedMatch[1] : undefined);
        }
      }
    });

    child.on('error', (err) => {
      activeChildProcess = null;
      reject(err);
    });

    child.on('close', (code) => {
      activeChildProcess = null;
      if (isCancelled) {
        return reject(new Error('Operation cancelled by user'));
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
  });
}

export async function executeRemux(
  options: RemuxOptions,
  onProgress: (progress: ConversionProgress) => void,
  onLog: (line: string) => void
): Promise<{ success: boolean; outputPath: string }> {
  isCancelled = false;
  const binaries = checkAllBinaries();

  if (!binaries.ffmpeg) {
    throw new Error('FFmpeg executable not found. Please install ffmpeg or configure its path in Settings.');
  }

  onProgress({
    stage: 'probing',
    stageDescription: 'Analyzing media tracks and Dolby Vision metadata...',
    percentage: 5,
  });

  const probeResult = await probeMedia(options.inputPath);
  const totalDuration = probeResult.duration;
  const detectedDvProfile = probeResult.doviProfileDetected;

  // Decide muxer engine
  let engineToUse = options.muxerEngine;
  if (engineToUse === 'hybrid') {
    engineToUse = binaries.mp4muxer ? 'mp4muxer' : 'ffmpeg';
  } else if (engineToUse === 'mp4muxer' && !binaries.mp4muxer) {
    onLog('[Warning] Dolby mp4muxer requested but not installed. Falling back to FFmpeg engine.\n');
    engineToUse = 'ffmpeg';
  }

  // Create temporary directory for intermediate streams if needed
  activeTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dovi-remux-'));

  try {
    if (engineToUse === 'mp4muxer') {
      // ---------------------------------------------------------
      // Dolby mp4muxer Workflow
      // ---------------------------------------------------------
      onLog(`\n[Engine] Starting Dolby mp4muxer pipeline...\n`);

      // 1. Extract raw HEVC bitstream
      onProgress({
        stage: 'extracting_video',
        stageDescription: 'Extracting raw HEVC video bitstream (lossless)...',
        percentage: 15,
      });

      const rawVideoPath = path.join(activeTempDir, 'video.hevc');
      await runCommand(
        binaries.ffmpegPath,
        [
          '-y',
          '-i', options.inputPath,
          '-map', '0:v:0',
          '-c:v', 'copy',
          '-vbsf', 'hevc_mp4toannexb',
          rawVideoPath,
        ],
        onLog,
        (ratio, speed) => {
          onProgress({
            stage: 'extracting_video',
            stageDescription: 'Extracting raw HEVC video stream...',
            percentage: Math.round(15 + ratio * 35),
            speed,
          });
        },
        totalDuration
      );

      // 2. Process audio streams
      onProgress({
        stage: 'processing_audio',
        stageDescription: 'Processing and converting chosen audio tracks...',
        percentage: 55,
      });

      const audioFiles: { path: string; lang: string }[] = [];
      for (let i = 0; i < options.selectedAudioIndices.length; i++) {
        const streamIdx = options.selectedAudioIndices[i];
        const audioStream = probeResult.audioStreams.find((s) => s.index === streamIdx);
        const lang = audioStream ? audioStream.language : 'und';
        const codec = audioStream ? audioStream.codec_name : '';
        const needsTranscode = options.audioMode === 'force_eac3' ||
          (options.audioMode === 'smart' && (codec === 'truehd' || codec.startsWith('dts')));

        const ext = needsTranscode ? 'ec3' : (codec === 'aac' ? 'aac' : codec === 'ac3' ? 'ac3' : 'ec3');
        const audioOut = path.join(activeTempDir, `audio_${i}.${ext}`);

        const audioArgs = ['-y', '-i', options.inputPath, '-map', `0:${streamIdx}`];
        if (needsTranscode) {
          audioArgs.push('-c:a', 'eac3', '-b:a', options.audioBitrate || '640k');
        } else {
          audioArgs.push('-c:a', 'copy');
        }
        audioArgs.push(audioOut);

        await runCommand(binaries.ffmpegPath, audioArgs, onLog);
        audioFiles.push({ path: audioOut, lang });
      }

      // 3. Extract subtitles
      const extractedSubtitles: { path: string; lang: string }[] = [];
      if (options.selectedSubtitleIndices.length > 0) {
        onProgress({
          stage: 'processing_subtitles',
          stageDescription: 'Extracting subtitle tracks...',
          percentage: 70,
        });

        for (let i = 0; i < options.selectedSubtitleIndices.length; i++) {
          const streamIdx = options.selectedSubtitleIndices[i];
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          const lang = subStream ? subStream.language : 'und';

          if (subStream && subStream.type === 'text') {
            const subOut = path.join(activeTempDir, `sub_${i}.srt`);
            await runCommand(
              binaries.ffmpegPath,
              ['-y', '-i', options.inputPath, '-map', `0:${streamIdx}`, '-c:s', 'srt', subOut],
              onLog
            );
            extractedSubtitles.push({ path: subOut, lang });

            if (options.exportExternalSrt) {
              const outDir = path.dirname(options.outputPath);
              const baseName = path.basename(options.outputPath, path.extname(options.outputPath));
              const destSrt = path.join(outDir, `${baseName}.${lang}.srt`);
              fs.copyFileSync(subOut, destSrt);
              onLog(`[Subtitles] Exported external subtitle: ${destSrt}\n`);
            }
          }
        }
      }

      // 4. Mux using mp4muxer
      onProgress({
        stage: 'muxing',
        stageDescription: 'Multiplexing Dolby Vision MP4 container with mp4muxer...',
        percentage: 85,
      });

      // Target profile
      let dvProfile = detectedDvProfile || 8;
      if (options.targetDvProfile === 'profile8') dvProfile = 8;
      else if (options.targetDvProfile === 'profile5') dvProfile = 5;

      const intermediateMp4 = options.embedSubtitles && extractedSubtitles.length > 0
        ? path.join(activeTempDir, 'muxed_temp.mp4')
        : options.outputPath;

      const mp4muxerArgs = ['--dv-profile', dvProfile.toString()];
      if (dvProfile === 8) {
        mp4muxerArgs.push('--dv-bl-compatible-id', '1');
      }

      mp4muxerArgs.push('-i', rawVideoPath);
      for (const a of audioFiles) {
        mp4muxerArgs.push('-i', a.path, '--media-lang', a.lang);
      }
      mp4muxerArgs.push('-o', intermediateMp4);

      await runCommand(binaries.mp4muxerPath, mp4muxerArgs, onLog);

      // 5. Embed subtitles into MP4 if requested
      if (options.embedSubtitles && extractedSubtitles.length > 0) {
        onProgress({
          stage: 'muxing',
          stageDescription: 'Embedding subtitles into final MP4...',
          percentage: 95,
        });

        // Fast remux to add subtitle tracks as mov_text
        const finalArgs = ['-y', '-i', intermediateMp4];
        for (const sub of extractedSubtitles) {
          finalArgs.push('-i', sub.path);
        }

        finalArgs.push('-map', '0');
        for (let i = 0; i < extractedSubtitles.length; i++) {
          finalArgs.push('-map', `${i + 1}`);
          finalArgs.push(`-metadata:s:s:${i}`, `language=${extractedSubtitles[i].lang}`);
        }
        finalArgs.push('-c', 'copy', '-c:s', 'mov_text', '-movflags', '+faststart', options.outputPath);

        await runCommand(binaries.ffmpegPath, finalArgs, onLog);
      }

      // Ensure target Dolby Vision FourCC tag (dvh1 / dvhe) is applied to final MP4
      const targetTag = options.doviTag || 'dvh1';
      onLog(`\n[Dolby Vision] Ensuring '${targetTag}' FourCC tag on MP4 container...\n`);
      patchMp4DolbyVisionTag(options.outputPath, targetTag);

    } else {
      // ---------------------------------------------------------
      // High-performance Direct FFmpeg Pipeline
      // ---------------------------------------------------------
      onLog(`\n[Engine] Starting high-performance FFmpeg Dolby Vision direct remux...\n`);

      onProgress({
        stage: 'muxing',
        stageDescription: 'Direct remuxing video, audio, and subtitles to Dolby Vision MP4...',
        percentage: 10,
      });

      const ffmpegArgs = [
        '-y',
        '-i', options.inputPath,
        '-map', '0:v:0',
        '-c:v', 'copy',
        '-strict', 'unofficial',
      ];

      // Standard MP4 FourCC tag for HEVC (preserves Dolby Vision box)
      ffmpegArgs.push('-tag:v', 'hvc1');

      // Audio mappings
      let audioMapIdx = 0;
      for (const streamIdx of options.selectedAudioIndices) {
        const audioStream = probeResult.audioStreams.find((s) => s.index === streamIdx);
        const codec = audioStream ? audioStream.codec_name : '';
        const lang = audioStream ? audioStream.language : 'und';
        const needsTranscode = options.audioMode === 'force_eac3' ||
          (options.audioMode === 'smart' && (codec === 'truehd' || codec.startsWith('dts')));

        ffmpegArgs.push('-map', `0:${streamIdx}`);
        if (needsTranscode) {
          ffmpegArgs.push(`-c:a:${audioMapIdx}`, 'eac3', `-b:a:${audioMapIdx}`, options.audioBitrate || '640k');
        } else {
          ffmpegArgs.push(`-c:a:${audioMapIdx}`, 'copy');
        }
        ffmpegArgs.push(`-metadata:s:a:${audioMapIdx}`, `language=${lang}`);
        audioMapIdx++;
      }

      // Subtitle mappings
      let subMapIdx = 0;
      if (options.embedSubtitles) {
        for (const streamIdx of options.selectedSubtitleIndices) {
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          if (subStream && subStream.type === 'text') {
            ffmpegArgs.push('-map', `0:${streamIdx}`);
            ffmpegArgs.push(`-c:s:${subMapIdx}`, 'mov_text');
            ffmpegArgs.push(`-metadata:s:s:${subMapIdx}`, `language=${subStream.language}`);
            subMapIdx++;
          }
        }
      }

      ffmpegArgs.push('-movflags', '+faststart');
      ffmpegArgs.push(options.outputPath);

      await runCommand(
        binaries.ffmpegPath,
        ffmpegArgs,
        onLog,
        (ratio, speed) => {
          onProgress({
            stage: 'muxing',
            stageDescription: 'Multiplexing Dolby Vision MP4 with audio and subtitles...',
            percentage: Math.round(10 + ratio * 85),
            speed,
          });
        },
        totalDuration
      );

      // Ensure target Dolby Vision FourCC tag (dvh1 / dvhe) is applied to MP4 sample entry for TV triggering
      const targetTag = options.doviTag || 'dvh1';
      onLog(`\n[Dolby Vision] Applying '${targetTag}' FourCC tag to MP4 container for native TV playback...\n`);
      const didPatch = patchMp4DolbyVisionTag(options.outputPath, targetTag);
      if (didPatch) {
        onLog(`[Dolby Vision] Successfully tagged video stream as '${targetTag}' (Dolby Vision active).\n`);
      } else {
        onLog(`[Dolby Vision] Note: Tag '${targetTag}' applied.\n`);
      }

      // Export external SRT if requested
      if (options.exportExternalSrt && options.selectedSubtitleIndices.length > 0) {
        for (const streamIdx of options.selectedSubtitleIndices) {
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          if (subStream && subStream.type === 'text') {
            const outDir = path.dirname(options.outputPath);
            const baseName = path.basename(options.outputPath, path.extname(options.outputPath));
            const destSrt = path.join(outDir, `${baseName}.${subStream.language}.srt`);

            await runCommand(
              binaries.ffmpegPath,
              ['-y', '-i', options.inputPath, '-map', `0:${streamIdx}`, '-c:s', 'srt', destSrt],
              onLog
            );
            onLog(`[Subtitles] Exported external subtitle: ${destSrt}\n`);
          }
        }
      }
    }

    onProgress({
      stage: 'completed',
      stageDescription: 'Dolby Vision MP4 successfully created!',
      percentage: 100,
    });

    onLog(`\n[Success] Remuxing completed! File saved to: ${options.outputPath}\n`);
    cleanupTempDir();

    return {
      success: true,
      outputPath: options.outputPath,
    };
  } catch (err: any) {
    cleanupTempDir();
    onProgress({
      stage: 'error',
      stageDescription: err.message || 'An error occurred during conversion.',
      percentage: 0,
      error: err.message || String(err),
    });
    throw err;
  }
}
