// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MoveObserver, formatMoveDisplay } from '../src/move-observer';

/**
 * Helper: build a Lichess-like move list container with <move> elements.
 */
function buildMoveList(
  moves: { text: string; active?: boolean }[],
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tview2';

  for (const m of moves) {
    const moveEl = document.createElement('move');
    moveEl.textContent = m.text;
    if (m.active) moveEl.classList.add('active');
    container.appendChild(moveEl);
  }

  document.body.appendChild(container);
  return container;
}

describe('formatMoveDisplay', () => {
  it('formats move number correctly', () => {
    expect(formatMoveDisplay(1)).toBe('Current Move: 1');
    expect(formatMoveDisplay(42)).toBe('Current Move: 42');
    expect(formatMoveDisplay(0)).toBe('Current Move: 0');
  });
});

describe('MoveObserver', () => {
  let observer: MoveObserver;

  beforeEach(() => {
    document.body.innerHTML = '';
    observer = new MoveObserver();
  });

  afterEach(() => {
    observer.stop();
  });

  describe('getCurrentMove', () => {
    it('returns the active move with correct moveNumber', () => {
      buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
        { text: 'Nf3', active: true },
        { text: 'Nc6' },
      ]);

      const move = observer.getCurrentMove();
      expect(move).not.toBeNull();
      expect(move!.moveNumber).toBe(3);
      expect(typeof move!.fen).toBe('string');
    });

    it('returns null when no move is active', () => {
      buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
      ]);

      expect(observer.getCurrentMove()).toBeNull();
    });

    it('returns null when no move list container exists', () => {
      expect(observer.getCurrentMove()).toBeNull();
    });

    it('returns moveNumber 1 for the first active move', () => {
      buildMoveList([
        { text: 'e4', active: true },
        { text: 'e5' },
      ]);

      const move = observer.getCurrentMove();
      expect(move).not.toBeNull();
      expect(move!.moveNumber).toBe(1);
    });

    it('works with .analyse__moves container', () => {
      // Use the alternative container class
      const container = document.createElement('div');
      container.className = 'analyse__moves';
      const moveEl = document.createElement('move');
      moveEl.textContent = 'd4';
      moveEl.classList.add('active');
      container.appendChild(moveEl);
      document.body.appendChild(container);

      const move = observer.getCurrentMove();
      expect(move).not.toBeNull();
      expect(move!.moveNumber).toBe(1);
    });
  });

  describe('start/stop lifecycle', () => {
    it('calls callback when a move becomes active', async () => {
      const container = buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
        { text: 'Nf3' },
      ]);

      const moves = container.querySelectorAll('move');
      const cb = vi.fn();

      observer.start(cb);

      // Simulate Lichess making a move active
      moves[1].classList.add('active');

      // MutationObserver is async — flush microtasks
      await new Promise((r) => setTimeout(r, 0));

      expect(cb).toHaveBeenCalled();
      expect(cb.mock.calls[0][0].moveNumber).toBe(2);
    });

    it('stops calling callback after stop()', async () => {
      const container = buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
      ]);

      const moves = container.querySelectorAll('move');
      const cb = vi.fn();

      observer.start(cb);
      observer.stop();

      // Mutate after stop
      moves[0].classList.add('active');
      await new Promise((r) => setTimeout(r, 0));

      expect(cb).not.toHaveBeenCalled();
    });

    it('retries when container is not immediately available', async () => {
      vi.useFakeTimers();
      const cb = vi.fn();

      // Start with no container — observer will schedule retries
      observer.start(cb);

      // Add container before the first retry fires
      buildMoveList([
        { text: 'e4', active: true },
      ]);

      // Advance past the first retry (100ms) so the observer finds the container
      vi.advanceTimersByTime(100);
      vi.useRealTimers();

      // After retry, getCurrentMove should work (observer found the container)
      const move = observer.getCurrentMove();
      expect(move).not.toBeNull();
      expect(move!.moveNumber).toBe(1);
    });

    it('does not throw when stop is called without start', () => {
      expect(() => observer.stop()).not.toThrow();
    });

    it('does not throw when stop is called multiple times', () => {
      buildMoveList([{ text: 'e4', active: true }]);
      observer.start(vi.fn());
      expect(() => {
        observer.stop();
        observer.stop();
      }).not.toThrow();
    });
  });
});
