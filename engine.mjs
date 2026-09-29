// electron/engine/binaries.ts
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
var customPaths = {};
function setCustomBinaryPaths(paths) {
  customPaths = { ...customPaths, ...paths };
}
function resolveBinary(name, customPath) {
  if (customPath && fs.existsSync(customPath)) {
    return { found: true, path: customPath };
  }
  const appPath = process.cwd();
  const bundledCandidates = [
    path.join(process.resourcesPath || "", "bin", process.platform === "win32" ? `${name}.exe` : name),
    path.join(appPath, "bin", process.platform === "win32" ? `${name}.exe` : name)
  ];
  for (const candidate of bundledCandidates) {
    if (fs.existsSync(candidate)) {
      return { found: true, path: candidate };
    }
  }
  const platformCandidates = [];
  if (process.platform === "darwin") {
    platformCandidates.push(
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`
    );
  } else if (process.platform === "win32") {
    const progFiles = process.env.ProgramFiles || "C:\\Program Files";
    const localAppData = process.env.LOCALAPPDATA || "";
    platformCandidates.push(
      path.join(progFiles, name, `${name}.exe`),
      path.join(localAppData, name, `${name}.exe`),
      `C:\\tools\\${name}\\${name}.exe`
    );
  } else {
    platformCandidates.push(
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      `/snap/bin/${name}`
    );
  }
  for (const candidate of platformCandidates) {
    if (fs.existsSync(candidate)) {
      return { found: true, path: candidate };
    }
  }
  try {
    const cmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;
    const stdout = execSync(cmd, {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`
      },
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    }).trim().split("\n")[0];
    if (stdout && fs.existsSync(stdout)) {
      return { found: true, path: stdout };
    }
  } catch {
  }
  return { found: false, path: name };
}
function checkAllBinaries() {
  const ffmpegRes = resolveBinary("ffmpeg", customPaths.ffmpegPath);
  const ffprobeRes = resolveBinary("ffprobe", customPaths.ffprobePath);
  const mp4muxerRes = resolveBinary("mp4muxer", customPaths.mp4muxerPath);
  const mp4boxRes = resolveBinary("MP4Box", customPaths.mp4boxPath);
  return {
    ffmpeg: ffmpegRes.found,
    ffprobe: ffprobeRes.found,
    mp4muxer: mp4muxerRes.found,
    mp4box: mp4boxRes.found,
    ffmpegPath: ffmpegRes.path,
    ffprobePath: ffprobeRes.path,
    mp4muxerPath: mp4muxerRes.path,
    mp4boxPath: mp4boxRes.path
  };
}

// electron/engine/probe.ts
import { execFile } from "node:child_process";
import path2 from "node:path";
import fs2 from "node:fs";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
async function probeMedia(filePath) {
  if (!fs2.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const binaries = checkAllBinaries();
  const ffprobePath = binaries.ffprobe ? binaries.ffprobePath : "ffprobe";
  const args = [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath
  ];
  let stdout = "";
  try {
    const res = await execFileAsync(ffprobePath, args, {
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`
      }
    });
    stdout = res.stdout;
  } catch (err) {
    throw new Error(`Failed to probe media file with ffprobe: ${err.message || err}`);
  }
  const data = JSON.parse(stdout);
  const streams = data.streams || [];
  const format = data.format || {};
  const fileStats = fs2.statSync(filePath);
  const duration = parseFloat(format.duration || "0");
  const fileName = path2.basename(filePath);
  const videoStreams = [];
  const audioStreams = [];
  const subtitleStreams = [];
  let doviProfileDetected = null;
  for (const stream of streams) {
    const codecType = stream.codec_type;
    const codecName = (stream.codec_name || "").toLowerCase();
    const tags = stream.tags || {};
    const disposition = stream.disposition || {};
    if (codecType === "video") {
      let dvProfile = null;
      let dvCompatId = null;
      let hdrFormat = "SDR";
      if (Array.isArray(stream.side_data_list)) {
        for (const sideData of stream.side_data_list) {
          const type = (sideData.side_data_type || "").toLowerCase();
          if (type.includes("dovi") || type.includes("dolby vision")) {
            if (typeof sideData.dv_profile === "number") {
              dvProfile = sideData.dv_profile;
              doviProfileDetected = dvProfile;
            }
            if (typeof sideData.dv_bl_signal_compatibility_id === "number") {
              dvCompatId = sideData.dv_bl_signal_compatibility_id;
            }
          }
        }
      }
      const colorTransfer = (stream.color_transfer || "").toLowerCase();
      const colorPrimaries = (stream.color_primaries || "").toLowerCase();
      const isHDR = colorTransfer.includes("smpte2084") || colorTransfer.includes("arib-std-b67") || colorPrimaries.includes("bt2020");
      if (dvProfile !== null) {
        if (dvProfile === 5) {
          hdrFormat = "Dolby Vision Profile 5 (Streaming IPTPQc2)";
        } else if (dvProfile === 8) {
          hdrFormat = `Dolby Vision Profile 8.${dvCompatId ?? 1} (HDR10 Base)`;
        } else if (dvProfile === 7) {
          hdrFormat = "Dolby Vision Profile 7 (Blu-ray UHD Dual Layer)";
        } else {
          hdrFormat = `Dolby Vision Profile ${dvProfile}`;
        }
      } else if (isHDR) {
        hdrFormat = colorTransfer.includes("arib-std-b67") ? "HLG (HDR)" : "HDR10";
      }
      let fps = "24";
      if (stream.r_frame_rate) {
        const parts = stream.r_frame_rate.split("/");
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
        pix_fmt: stream.pix_fmt || "",
        dovi_profile: dvProfile,
        dovi_compatibility_id: dvCompatId,
        hdr_format: hdrFormat,
        bitrate: stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate, 10) / 1e3)} kbps` : "Auto",
        duration: parseFloat(stream.duration || format.duration || "0")
      });
    } else if (codecType === "audio") {
      const language = tags.language || "und";
      const title = tags.title || "";
      const channels = stream.channels || 2;
      const channelLayout = stream.channel_layout || (channels === 8 ? "7.1" : channels === 6 ? "5.1" : "stereo");
      const isNeedsTranscode = codecName === "truehd" || codecName.startsWith("dts");
      audioStreams.push({
        index: stream.index,
        codec_name: codecName,
        language,
        title: title || `${language.toUpperCase()} (${codecName.toUpperCase()} ${channelLayout})`,
        channels,
        channel_layout: channelLayout,
        bitrate: stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate, 10) / 1e3)} kbps` : "Unknown",
        sample_rate: stream.sample_rate ? `${stream.sample_rate} Hz` : "",
        is_default: disposition.default === 1,
        is_forced: disposition.forced === 1,
        tv_compatibility: isNeedsTranscode ? "needs_transcode" : "native"
      });
    } else if (codecType === "subtitle") {
      const language = tags.language || "und";
      const title = tags.title || "";
      const isBitmap = codecName.includes("pgs") || codecName.includes("dvd") || codecName.includes("dvb");
      subtitleStreams.push({
        index: stream.index,
        codec_name: codecName,
        language,
        title: title || `${language.toUpperCase()} (${isBitmap ? "PGS Bitmap" : codecName.toUpperCase()})`,
        is_default: disposition.default === 1,
        is_forced: disposition.forced === 1,
        type: isBitmap ? "bitmap" : "text"
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
    doviProfileDetected
  };
}

// electron/engine/remuxer.ts
import { spawn } from "node:child_process";
import path3 from "node:path";
import fs3 from "node:fs";
import os from "node:os";
var activeChildProcess = null;
var activeTempDir = null;
var isCancelled = false;
function cancelCurrentRemux() {
  isCancelled = true;
  if (activeChildProcess) {
    try {
      activeChildProcess.kill("SIGKILL");
    } catch {
    }
    activeChildProcess = null;
  }
  cleanupTempDir();
}
function cleanupTempDir() {
  if (activeTempDir && fs3.existsSync(activeTempDir)) {
    try {
      fs3.rmSync(activeTempDir, { recursive: true, force: true });
    } catch {
    }
    activeTempDir = null;
  }
}
function runCommand(cmd, args, onData, onProgressRatio, totalDurationSeconds) {
  return new Promise((resolve, reject) => {
    if (isCancelled) {
      return reject(new Error("Operation cancelled by user"));
    }
    onData(`[Executing] ${cmd} ${args.join(" ")}
`);
    const child = spawn(cmd, args, {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`
      }
    });
    activeChildProcess = child;
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      onData(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      onData(text);
      if (totalDurationSeconds && totalDurationSeconds > 0 && onProgressRatio) {
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        const speedMatch = text.match(/speed=\s*([\d.]+x)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const currentSec = hours * 3600 + minutes * 60 + seconds;
          const ratio = Math.min(0.99, Math.max(0, currentSec / totalDurationSeconds));
          onProgressRatio(ratio, speedMatch ? speedMatch[1] : void 0);
        }
      }
    });
    child.on("error", (err) => {
      activeChildProcess = null;
      reject(err);
    });
    child.on("close", (code) => {
      activeChildProcess = null;
      if (isCancelled) {
        return reject(new Error("Operation cancelled by user"));
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
  });
}
async function executeRemux(options, onProgress, onLog) {
  isCancelled = false;
  const binaries = checkAllBinaries();
  if (!binaries.ffmpeg) {
    throw new Error("FFmpeg executable not found. Please install ffmpeg or configure its path in Settings.");
  }
  onProgress({
    stage: "probing",
    stageDescription: "Analyzing media tracks and Dolby Vision metadata...",
    percentage: 5
  });
  const probeResult = await probeMedia(options.inputPath);
  const totalDuration = probeResult.duration;
  const detectedDvProfile = probeResult.doviProfileDetected;
  let engineToUse = options.muxerEngine;
  if (engineToUse === "hybrid") {
    engineToUse = binaries.mp4muxer ? "mp4muxer" : "ffmpeg";
  } else if (engineToUse === "mp4muxer" && !binaries.mp4muxer) {
    onLog("[Warning] Dolby mp4muxer requested but not installed. Falling back to FFmpeg engine.\n");
    engineToUse = "ffmpeg";
  }
  activeTempDir = fs3.mkdtempSync(path3.join(os.tmpdir(), "dovi-remux-"));
  try {
    if (engineToUse === "mp4muxer") {
      onLog(`
[Engine] Starting Dolby mp4muxer pipeline...
`);
      onProgress({
        stage: "extracting_video",
        stageDescription: "Extracting raw HEVC video bitstream (lossless)...",
        percentage: 15
      });
      const rawVideoPath = path3.join(activeTempDir, "video.hevc");
      await runCommand(
        binaries.ffmpegPath,
        [
          "-y",
          "-i",
          options.inputPath,
          "-map",
          "0:v:0",
          "-c:v",
          "copy",
          "-vbsf",
          "hevc_mp4toannexb",
          rawVideoPath
        ],
        onLog,
        (ratio, speed) => {
          onProgress({
            stage: "extracting_video",
            stageDescription: "Extracting raw HEVC video stream...",
            percentage: Math.round(15 + ratio * 35),
            speed
          });
        },
        totalDuration
      );
      onProgress({
        stage: "processing_audio",
        stageDescription: "Processing and converting chosen audio tracks...",
        percentage: 55
      });
      const audioFiles = [];
      for (let i = 0; i < options.selectedAudioIndices.length; i++) {
        const streamIdx = options.selectedAudioIndices[i];
        const audioStream = probeResult.audioStreams.find((s) => s.index === streamIdx);
        const lang = audioStream ? audioStream.language : "und";
        const codec = audioStream ? audioStream.codec_name : "";
        const needsTranscode = options.audioMode === "force_eac3" || options.audioMode === "smart" && (codec === "truehd" || codec.startsWith("dts"));
        const ext = needsTranscode ? "ec3" : codec === "aac" ? "aac" : codec === "ac3" ? "ac3" : "ec3";
        const audioOut = path3.join(activeTempDir, `audio_${i}.${ext}`);
        const audioArgs = ["-y", "-i", options.inputPath, "-map", `0:${streamIdx}`];
        if (needsTranscode) {
          audioArgs.push("-c:a", "eac3", "-b:a", options.audioBitrate || "640k");
        } else {
          audioArgs.push("-c:a", "copy");
        }
        audioArgs.push(audioOut);
        await runCommand(binaries.ffmpegPath, audioArgs, onLog);
        audioFiles.push({ path: audioOut, lang });
      }
      const extractedSubtitles = [];
      if (options.selectedSubtitleIndices.length > 0) {
        onProgress({
          stage: "processing_subtitles",
          stageDescription: "Extracting subtitle tracks...",
          percentage: 70
        });
        for (let i = 0; i < options.selectedSubtitleIndices.length; i++) {
          const streamIdx = options.selectedSubtitleIndices[i];
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          const lang = subStream ? subStream.language : "und";
          if (subStream && subStream.type === "text") {
            const subOut = path3.join(activeTempDir, `sub_${i}.srt`);
            await runCommand(
              binaries.ffmpegPath,
              ["-y", "-i", options.inputPath, "-map", `0:${streamIdx}`, "-c:s", "srt", subOut],
              onLog
            );
            extractedSubtitles.push({ path: subOut, lang });
            if (options.exportExternalSrt) {
              const outDir = path3.dirname(options.outputPath);
              const baseName = path3.basename(options.outputPath, path3.extname(options.outputPath));
              const destSrt = path3.join(outDir, `${baseName}.${lang}.srt`);
              fs3.copyFileSync(subOut, destSrt);
              onLog(`[Subtitles] Exported external subtitle: ${destSrt}
`);
            }
          }
        }
      }
      onProgress({
        stage: "muxing",
        stageDescription: "Multiplexing Dolby Vision MP4 container with mp4muxer...",
        percentage: 85
      });
      let dvProfile = detectedDvProfile || 8;
      if (options.targetDvProfile === "profile8") dvProfile = 8;
      else if (options.targetDvProfile === "profile5") dvProfile = 5;
      const intermediateMp4 = options.embedSubtitles && extractedSubtitles.length > 0 ? path3.join(activeTempDir, "muxed_temp.mp4") : options.outputPath;
      const mp4muxerArgs = ["--dv-profile", dvProfile.toString()];
      if (dvProfile === 8) {
        mp4muxerArgs.push("--dv-bl-compatible-id", "1");
      }
      mp4muxerArgs.push("-i", rawVideoPath);
      for (const a of audioFiles) {
        mp4muxerArgs.push("-i", a.path, "--media-lang", a.lang);
      }
      mp4muxerArgs.push("-o", intermediateMp4);
      await runCommand(binaries.mp4muxerPath, mp4muxerArgs, onLog);
      if (options.embedSubtitles && extractedSubtitles.length > 0) {
        onProgress({
          stage: "muxing",
          stageDescription: "Embedding subtitles into final MP4...",
          percentage: 95
        });
        const finalArgs = ["-y", "-i", intermediateMp4];
        for (const sub of extractedSubtitles) {
          finalArgs.push("-i", sub.path);
        }
        finalArgs.push("-map", "0");
        for (let i = 0; i < extractedSubtitles.length; i++) {
          finalArgs.push("-map", `${i + 1}`);
          finalArgs.push(`-metadata:s:s:${i}`, `language=${extractedSubtitles[i].lang}`);
        }
        finalArgs.push("-c", "copy", "-c:s", "mov_text", options.outputPath);
        await runCommand(binaries.ffmpegPath, finalArgs, onLog);
      }
    } else {
      onLog(`
[Engine] Starting high-performance FFmpeg Dolby Vision direct remux...
`);
      onProgress({
        stage: "muxing",
        stageDescription: "Direct remuxing video, audio, and subtitles to Dolby Vision MP4...",
        percentage: 10
      });
      const ffmpegArgs = [
        "-y",
        "-i",
        options.inputPath,
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "-strict",
        "unofficial"
      ];
      ffmpegArgs.push("-tag:v", "hvc1");
      let audioMapIdx = 0;
      for (const streamIdx of options.selectedAudioIndices) {
        const audioStream = probeResult.audioStreams.find((s) => s.index === streamIdx);
        const codec = audioStream ? audioStream.codec_name : "";
        const lang = audioStream ? audioStream.language : "und";
        const needsTranscode = options.audioMode === "force_eac3" || options.audioMode === "smart" && (codec === "truehd" || codec.startsWith("dts"));
        ffmpegArgs.push("-map", `0:${streamIdx}`);
        if (needsTranscode) {
          ffmpegArgs.push(`-c:a:${audioMapIdx}`, "eac3", `-b:a:${audioMapIdx}`, options.audioBitrate || "640k");
        } else {
          ffmpegArgs.push(`-c:a:${audioMapIdx}`, "copy");
        }
        ffmpegArgs.push(`-metadata:s:a:${audioMapIdx}`, `language=${lang}`);
        audioMapIdx++;
      }
      let subMapIdx = 0;
      if (options.embedSubtitles) {
        for (const streamIdx of options.selectedSubtitleIndices) {
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          if (subStream && subStream.type === "text") {
            ffmpegArgs.push("-map", `0:${streamIdx}`);
            ffmpegArgs.push(`-c:s:${subMapIdx}`, "mov_text");
            ffmpegArgs.push(`-metadata:s:s:${subMapIdx}`, `language=${subStream.language}`);
            subMapIdx++;
          }
        }
      }
      ffmpegArgs.push(options.outputPath);
      await runCommand(
        binaries.ffmpegPath,
        ffmpegArgs,
        onLog,
        (ratio, speed) => {
          onProgress({
            stage: "muxing",
            stageDescription: "Multiplexing Dolby Vision MP4 with audio and subtitles...",
            percentage: Math.round(10 + ratio * 85),
            speed
          });
        },
        totalDuration
      );
      if (options.exportExternalSrt && options.selectedSubtitleIndices.length > 0) {
        for (const streamIdx of options.selectedSubtitleIndices) {
          const subStream = probeResult.subtitleStreams.find((s) => s.index === streamIdx);
          if (subStream && subStream.type === "text") {
            const outDir = path3.dirname(options.outputPath);
            const baseName = path3.basename(options.outputPath, path3.extname(options.outputPath));
            const destSrt = path3.join(outDir, `${baseName}.${subStream.language}.srt`);
            await runCommand(
              binaries.ffmpegPath,
              ["-y", "-i", options.inputPath, "-map", `0:${streamIdx}`, "-c:s", "srt", destSrt],
              onLog
            );
            onLog(`[Subtitles] Exported external subtitle: ${destSrt}
`);
          }
        }
      }
    }
    onProgress({
      stage: "completed",
      stageDescription: "Dolby Vision MP4 successfully created!",
      percentage: 100
    });
    onLog(`
[Success] Remuxing completed! File saved to: ${options.outputPath}
`);
    cleanupTempDir();
    return {
      success: true,
      outputPath: options.outputPath
    };
  } catch (err) {
    cleanupTempDir();
    onProgress({
      stage: "error",
      stageDescription: err.message || "An error occurred during conversion.",
      percentage: 0,
      error: err.message || String(err)
    });
    throw err;
  }
}
export {
  cancelCurrentRemux,
  checkAllBinaries,
  executeRemux,
  probeMedia,
  setCustomBinaryPaths
};
