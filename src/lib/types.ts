export interface Source {
  label: string;
  origin: string;
  kind: 'folder' | 'file';
}
export interface Scene {
  id: string;
  label: string;
  frames: (string | null)[];
}
export interface ComparisonMatrix {
  sources: Source[];
  scenes: Scene[];
  warnings: string[];
}
export interface Frame {
  width: number;
  height: number;
  depth: 8 | 16;
  originalDepth: number;
  fileSize: number;
  pixels: Uint8Array | Uint16Array;
  /** Releases a native mapping when the owning renderer removes this frame. */
  release?: () => void;
}
export interface Pixel {
  x: number;
  y: number;
  samples: number[];
  rgb8: number[];
  rgb10: number[];
  hex: string;
  depth: number;
}
export interface Metric {
  slot: number;
  score: number | null;
  resampled: boolean;
  error?: string;
}
export type Point = { x: number; y: number };
export type Filter = 'auto' | 'nearest' | 'linear';
export type Mode = 0 | 1 | 2 | 3 | 4;
export interface ViewState {
  zoom: number;
  pan: Point;
  mouse: Point;
  mode: Mode;
  subMode: number;
  slotA: number;
  slotB: number;
  gain: number;
  bandFrequency: number;
  loupe: boolean;
  grid: boolean;
  filter: Filter;
}
