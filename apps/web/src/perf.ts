/**
 * Device capability check for visual effects. On weak phones (≤ 2 GB RAM or ≤ 2 CPU cores) and when
 * the user asked to save data, the app shows still scenery and skips background animation
 * (`:root[data-perf='lite']`). Gameplay, feedback and readability are identical in both modes.
 */
interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function isLiteDevice(nav: NavigatorHints | undefined = globalThis.navigator as NavigatorHints | undefined): boolean {
  if (!nav) return false;
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2) return true;
  return false;
}

export function applyPerfMode(): void {
  if (isLiteDevice()) document.documentElement.dataset.perf = 'lite';
}
