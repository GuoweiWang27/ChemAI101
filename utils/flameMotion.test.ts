import { describe, expect, it } from 'vitest';

describe('homepage flame motion contract', () => {
  it('progresses through flash, color, and readout beats', async () => {
    const module = await import('../components/FlameHeroCanvas');
    const getFlameMotionStage = (module as Record<string, unknown>).getFlameMotionStage;

    expect(getFlameMotionStage).toBeTypeOf('function');
    const getStage = getFlameMotionStage as (elapsedMs: number, reduced: boolean) => string;
    expect(getStage(0, false)).toBe('flash');
    expect(getStage(199, false)).toBe('flash');
    expect(getStage(200, false)).toBe('color');
    expect(getStage(799, false)).toBe('color');
    expect(getStage(800, false)).toBe('readout');
    expect(getStage(0, true)).toBe('readout');
  });

  it('stops automatic cycling after user interaction or when motion is unavailable', async () => {
    const module = await import('../components/FlameHeroCanvas');
    const shouldAdvanceFlameCycle = (module as Record<string, unknown>).shouldAdvanceFlameCycle;

    expect(shouldAdvanceFlameCycle).toBeTypeOf('function');
    const shouldAdvance = shouldAdvanceFlameCycle as (
      hasInteracted: boolean,
      motionAvailable: boolean,
      reduced: boolean,
    ) => boolean;
    expect(shouldAdvance(false, true, false)).toBe(true);
    expect(shouldAdvance(true, true, false)).toBe(false);
    expect(shouldAdvance(false, false, false)).toBe(false);
    expect(shouldAdvance(false, true, true)).toBe(false);
  });

  it('derives a capped DPR backing store while preserving the rendered aspect ratio', async () => {
    const module = await import('../components/FlameHeroCanvas');
    const getCanvasBackingSize = (module as Record<string, unknown>).getCanvasBackingSize;

    expect(getCanvasBackingSize).toBeTypeOf('function');
    const getSize = getCanvasBackingSize as (
      cssWidth: number,
      cssHeight: number,
      devicePixelRatio: number,
    ) => { width: number; height: number };
    const desktop = getSize(387, 298, 2.2);
    const mobile = getSize(271, 278, 3);

    expect(desktop.width).toBeLessThanOrEqual(Math.round(387 * 1.5));
    expect(mobile.width).toBeLessThanOrEqual(Math.round(271 * 1.5));
    expect(desktop.width / desktop.height).toBeCloseTo(387 / 298, 2);
    expect(mobile.width / mobile.height).toBeCloseTo(271 / 278, 2);
  });
});
