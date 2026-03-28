import type { Mock } from 'vitest';

interface MockElectronAPI {
  onRenderProgress: (listener: (data: unknown) => void) => () => void;
  [key: string]: unknown;
}

const mockContextBridge = {
  exposeInMainWorld: vi.fn()
};
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
};
const mockWebUtils = {
  getPathForFile: vi.fn()
};

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
  webUtils: mockWebUtils
}));

describe('preload', () => {
  let electronAPI: MockElectronAPI;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContextBridge.exposeInMainWorld.mockImplementation((_name: string, api: MockElectronAPI) => {
      electronAPI = api;
    });
    vi.resetModules();
    await import('../../src/preload.ts');
  });

  test('exposes render progress listener with unsubscribe support', () => {
    const listener = vi.fn();
    const unsubscribe = electronAPI.onRenderProgress(listener);

    expect(mockIpcRenderer.on).toHaveBeenCalledWith('render-composite-progress', expect.any(Function));

    const handler = (mockIpcRenderer.on as Mock).mock.calls[0]![1] as (_event: unknown, payload: unknown) => void;
    handler({}, { percent: 0.4, status: 'Rendering 40%' });

    expect(listener).toHaveBeenCalledWith({ percent: 0.4, status: 'Rendering 40%' });

    unsubscribe();

    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('render-composite-progress', handler);
  });
});
