import { contextBridge, ipcRenderer } from 'electron';
import type { RemuxOptions, ConversionProgress, BinaryStatus } from '../src/types/index';

contextBridge.exposeInMainWorld('api', {
  probeMedia: (filePath: string) => ipcRenderer.invoke('media:probe', filePath),
  startRemux: (options: RemuxOptions) => ipcRenderer.invoke('remux:start', options),
  cancelRemux: () => ipcRenderer.invoke('remux:cancel'),
  onProgress: (callback: (progress: ConversionProgress) => void) => {
    const subscription = (_event: any, progress: ConversionProgress) => callback(progress);
    ipcRenderer.on('conversion:progress', subscription);
    return () => ipcRenderer.removeListener('conversion:progress', subscription);
  },
  onLog: (callback: (log: string) => void) => {
    const subscription = (_event: any, log: string) => callback(log);
    ipcRenderer.on('conversion:log', subscription);
    return () => ipcRenderer.removeListener('conversion:log', subscription);
  },
  checkBinaries: () => ipcRenderer.invoke('binaries:check'),
  setBinaryPaths: (paths: Partial<BinaryStatus>) => ipcRenderer.invoke('binaries:set-paths', paths),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectFile: () => ipcRenderer.invoke('dialog:select-file'),
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-item', filePath),
});
