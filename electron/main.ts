import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { probeMedia } from './engine/probe';
import { executeRemux, cancelCurrentRemux } from './engine/remuxer';
import { checkAllBinaries, setCustomBinaryPaths } from './engine/binaries';
import type { RemuxOptions, BinaryStatus } from '../src/types/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.mjs');
  const finalPreload = fs.existsSync(preloadPath) ? preloadPath : path.join(__dirname, 'preload.js');

  win = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 840,
    minHeight: 680,
    title: 'DoVi Remuxer',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#090d16',
    webPreferences: {
      preload: finalPreload,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }

  // Open external links in default OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC Handlers
ipcMain.handle('media:probe', async (_event, filePath: string) => {
  return await probeMedia(filePath);
});

ipcMain.handle('remux:start', async (event, options: RemuxOptions) => {
  return await executeRemux(
    options,
    (progress) => {
      if (win && !win.isDestroyed()) {
        event.sender.send('conversion:progress', progress);
      }
    },
    (log) => {
      if (win && !win.isDestroyed()) {
        event.sender.send('conversion:log', log);
      }
    }
  );
});

ipcMain.handle('remux:cancel', async () => {
  cancelCurrentRemux();
});

ipcMain.handle('binaries:check', async () => {
  return checkAllBinaries();
});

ipcMain.handle('binaries:set-paths', async (_event, paths: Partial<BinaryStatus>) => {
  setCustomBinaryPaths(paths);
  return checkAllBinaries();
});

ipcMain.handle('dialog:select-folder', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:select-file', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'MKV Video (*.mkv)', extensions: ['mkv'] },
      { name: 'All Videos (*.mkv, *.mp4, *.ts)', extensions: ['mkv', 'mp4', 'ts', 'm2ts'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('shell:show-item', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
