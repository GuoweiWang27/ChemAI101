export type FlameMotionStage = 'flash' | 'color' | 'readout';

export const getFlameMotionStage = (elapsedMs: number, reduced: boolean): FlameMotionStage => {
  if (reduced) return 'readout';
  if (elapsedMs < 200) return 'flash';
  if (elapsedMs < 800) return 'color';
  return 'readout';
};

export const shouldAdvanceFlameCycle = (
  hasInteracted: boolean,
  motionAvailable: boolean,
  reduced: boolean,
) => !hasInteracted && motionAvailable && !reduced;

export const getCanvasBackingSize = (
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
) => {
  const dpr = Math.min(1.5, Math.max(1, devicePixelRatio || 1));
  const renderScale = 0.9;
  return {
    width: Math.max(1, Math.round(cssWidth * dpr * renderScale)),
    height: Math.max(1, Math.round(cssHeight * dpr * renderScale)),
  };
};
