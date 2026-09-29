import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { BinaryStatus } from '../../src/types/index';

// Configurable path cache
let customPaths: Partial<BinaryStatus> = {};

export function setCustomBinaryPaths(paths: Partial<BinaryStatus>) {
  customPaths = { ...customPaths, ...paths };
}

function resolveBinary(name: string, customPath?: string): { found: boolean; path: string } {
  // 1. Check custom path if provided
  if (customPath && fs.existsSync(customPath)) {
    return { found: true, path: customPath };
  }

  // 2. Check bundled resources directory
  const appPath = process.cwd();
  const bundledCandidates = [
    path.join(process.resourcesPath || '', 'bin', process.platform === 'win32' ? `${name}.exe` : name),
    path.join(appPath, 'bin', process.platform === 'win32' ? `${name}.exe` : name),
  ];

  for (const candidate of bundledCandidates) {
    if (fs.existsSync(candidate)) {
      return { found: true, path: candidate };
    }
  }

  // 3. Check system PATH and common installation directories
  const platformCandidates: string[] = [];
  if (process.platform === 'darwin') {
    platformCandidates.push(
      `/opt/homebrew/bin/${name}`,
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`
    );
  } else if (process.platform === 'win32') {
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const localAppData = process.env.LOCALAPPDATA || '';
    platformCandidates.push(
      path.join(progFiles, name, `${name}.exe`),
      path.join(localAppData, name, `${name}.exe`),
      `C:\\tools\\${name}\\${name}.exe`
    );
  } else {
    // Linux
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

  // 4. Try which / where command
  try {
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    const stdout = execSync(cmd, {
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
      },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim().split('\n')[0];

    if (stdout && fs.existsSync(stdout)) {
      return { found: true, path: stdout };
    }
  } catch {
    // Not found in PATH
  }

  return { found: false, path: name };
}

export function checkAllBinaries(): BinaryStatus {
  const ffmpegRes = resolveBinary('ffmpeg', customPaths.ffmpegPath);
  const ffprobeRes = resolveBinary('ffprobe', customPaths.ffprobePath);
  const mp4muxerRes = resolveBinary('mp4muxer', customPaths.mp4muxerPath);
  const mp4boxRes = resolveBinary('MP4Box', customPaths.mp4boxPath);

  return {
    ffmpeg: ffmpegRes.found,
    ffprobe: ffprobeRes.found,
    mp4muxer: mp4muxerRes.found,
    mp4box: mp4boxRes.found,
    ffmpegPath: ffmpegRes.path,
    ffprobePath: ffprobeRes.path,
    mp4muxerPath: mp4muxerRes.path,
    mp4boxPath: mp4boxRes.path,
  };
}
