import type { Point } from '../types';

export function toUv(
  screen: Point,
  pan: Point,
  zoom: number,
  width: number,
  height: number,
): Point {
  return { x: (screen.x - pan.x) / (zoom * width), y: (screen.y - pan.y) / (zoom * height) };
}
export function zoomAround(cursor: Point, pan: Point, oldZoom: number, newZoom: number): Point {
  return {
    x: cursor.x - ((cursor.x - pan.x) * newZoom) / oldZoom,
    y: cursor.y - ((cursor.y - pan.y) * newZoom) / oldZoom,
  };
}
export function panelPoint(point: Point, canvasWidth: number, split: boolean): Point {
  return {
    x: split && point.x >= canvasWidth / 2 ? point.x - canvasWidth / 2 : point.x,
    y: point.y,
  };
}
export function fitView(
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number,
  split: boolean,
  padding = 0,
) {
  const panelWidth = split ? canvasWidth / 2 : canvasWidth;
  const zoom = Math.max(
    0.001,
    Math.min((panelWidth - padding * 2) / width, (canvasHeight - padding * 2) / height),
  );
  return {
    zoom,
    pan: { x: (panelWidth - width * zoom) / 2, y: (canvasHeight - height * zoom) / 2 },
  };
}
