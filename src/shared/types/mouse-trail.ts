export interface MouseTrailEntry {
  t: number;
  x: number;
  y: number;
}

export interface MouseTrailData {
  captureWidth: number;
  captureHeight: number;
  interval: number;
  trail: MouseTrailEntry[];
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface MouseFocus {
  focusX: number;
  focusY: number;
}

export interface TrailKeypoint {
  time: number;
  focusX: number;
  focusY: number;
}
