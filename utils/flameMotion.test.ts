import { describe, expect, it } from 'vitest';
import {
  getCanvasBackingSize,
  getFlameMotionStage,
  shouldAdvanceFlameCycle,
} from './flameMotion';

describe('homepage flame motion contract', () => {
  it('progresses through flash, color, and readout beats', () => {
    expect(getFlameMotionStage(0, false)).toBe('flash');
    expect(getFlameMotionStage(199, false)).toBe('flash');
    expect(getFlameMotionStage(200, false)).toBe('color');
    expect(getFlameMotionStage(799, false)).toBe('color');
    expect(getFlameMotionStage(800, false)).toBe('readout');
    expect(getFlameMotionStage(0, true)).toBe('readout');
  });

  it('stops automatic cycling after user interaction or when motion is unavailable', () => {
    expect(shouldAdvanceFlameCycle(false, true, false)).toBe(true);
    expect(shouldAdvanceFlameCycle(true, true, false)).toBe(false);
    expect(shouldAdvanceFlameCycle(false, false, false)).toBe(false);
    expect(shouldAdvanceFlameCycle(false, true, true)).toBe(false);
  });

  it('derives a capped DPR backing store while preserving the rendered aspect ratio', () => {
    const desktop = getCanvasBackingSize(387, 298, 2.2);
    const mobile = getCanvasBackingSize(271, 278, 3);

    expect(desktop.width).toBeLessThanOrEqual(Math.round(387 * 1.5));
    expect(mobile.width).toBeLessThanOrEqual(Math.round(271 * 1.5));
    expect(desktop.width / desktop.height).toBeCloseTo(387 / 298, 2);
    expect(mobile.width / mobile.height).toBeCloseTo(271 / 278, 2);
  });
});
