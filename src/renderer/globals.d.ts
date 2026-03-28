import type { ElectronAPI } from '../shared/types/ipc.js';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
