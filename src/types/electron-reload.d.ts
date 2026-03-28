declare module 'electron-reload' {
  function reload(paths: string, opts?: Record<string, unknown>): void;
  export = reload;
}
