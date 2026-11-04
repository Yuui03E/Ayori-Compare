import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type WindowAction = 'minimize' | 'toggleMaximize' | 'close';
export async function controlWindow(action: WindowAction) {
  if (isTauri()) await getCurrentWindow()[action]();
}
