import type { IElectronAPI, MediaProbeResult, RemuxOptions, ConversionProgress, BinaryStatus } from './types/index';

// Event listeners for web mode
const progressListeners = new Set<(progress: ConversionProgress) => void>();
const logListeners = new Set<(log: string) => void>();
let eventSource: EventSource | null = null;

function ensureEventSource() {
  if (typeof window === 'undefined' || eventSource) return;
  try {
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          progressListeners.forEach((cb) => cb(data.payload));
        } else if (data.type === 'log') {
          logListeners.forEach((cb) => cb(data.payload));
        }
      } catch (e) {
        console.error('Failed to parse SSE event', e);
      }
    };
    eventSource.onerror = () => {
      // Reconnection handled automatically by browser
    };
  } catch {
    // Not running in web server mode
  }
}

// Universal client that works seamlessly both in Electron and in standard browsers
export const clientApi: IElectronAPI = (typeof window !== 'undefined' && (window as any).api) ? (window as any).api : {
  probeMedia: async (filePath: string): Promise<MediaProbeResult> => {
    const res = await fetch('/api/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to probe file');
    }
    return res.json();
  },

  startRemux: async (options: RemuxOptions): Promise<{ success: boolean; outputPath: string }> => {
    const res = await fetch('/api/remux', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start remux');
    }
    return res.json();
  },

  cancelRemux: async (): Promise<void> => {
    await fetch('/api/cancel', { method: 'POST' });
  },

  onProgress: (callback: (progress: ConversionProgress) => void) => {
    ensureEventSource();
    progressListeners.add(callback);
    return () => {
      progressListeners.delete(callback);
    };
  },

  onLog: (callback: (log: string) => void) => {
    ensureEventSource();
    logListeners.add(callback);
    return () => {
      logListeners.delete(callback);
    };
  },

  checkBinaries: async (): Promise<BinaryStatus> => {
    const res = await fetch('/api/binaries');
    return res.json();
  },

  setBinaryPaths: async (paths: Partial<BinaryStatus>): Promise<BinaryStatus> => {
    const res = await fetch('/api/binaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paths),
    });
    return res.json();
  },

  selectFolder: async (): Promise<string | null> => {
    const res = await fetch('/api/dialog/select-folder', { method: 'POST' });
    const data = await res.json();
    return data.folder || null;
  },

  selectFile: async (): Promise<string | null> => {
    const res = await fetch('/api/dialog/select-file', { method: 'POST' });
    const data = await res.json();
    return data.file || null;
  },

  showInFolder: async (filePath: string): Promise<void> => {
    await fetch('/api/shell/show-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
  },
};
