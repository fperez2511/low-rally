import { describe, expect, it } from 'vitest';
import { GameFlow } from './flow';

describe('GameFlow', () => {
  it('starts on the title screen, not stepping', () => {
    const f = new GameFlow();
    expect(f.state).toBe('title');
    expect(f.isStepping).toBe(false);
  });

  it('follows the legal transitions', () => {
    const f = new GameFlow();
    expect(f.start()).toBe(true);
    expect(f.state).toBe('playing');
    expect(f.isStepping).toBe(true);
    expect(f.pause()).toBe(true);
    expect(f.state).toBe('paused');
    expect(f.isStepping).toBe(false);
    expect(f.resume()).toBe(true);
    expect(f.state).toBe('playing');
    expect(f.pause()).toBe(true);
    expect(f.restart()).toBe(true);
    expect(f.state).toBe('playing');
  });

  it('ignores illegal transitions', () => {
    const f = new GameFlow();
    expect(f.pause()).toBe(false);
    expect(f.resume()).toBe(false);
    expect(f.restart()).toBe(false);
    expect(f.state).toBe('title');
    f.start();
    expect(f.start()).toBe(false);
    expect(f.resume()).toBe(false);
    expect(f.restart()).toBe(false);
    expect(f.state).toBe('playing');
    f.pause();
    expect(f.pause()).toBe(false);
    expect(f.start()).toBe(false);
    expect(f.state).toBe('paused');
  });

  it('asks for restart confirmation only while the clock is running', () => {
    const f = new GameFlow();
    expect(f.needsRestartConfirm('running')).toBe(true);
    expect(f.needsRestartConfirm('armed')).toBe(false);
    expect(f.needsRestartConfirm('finished')).toBe(false);
  });
});
