import type { Move } from './types/index';

/**
 * Formats a move number for display in the sidebar.
 */
export function formatMoveDisplay(moveNumber: number): string {
  return `Current Move: ${moveNumber}`;
}

/**
 * Detects the currently selected move on the Lichess Study page
 * using a MutationObserver on the move list container.
 */
export class MoveObserver {
  private observer: MutationObserver | null = null;
  private callback: ((move: Move) => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Find the move list container element (.tview2 or .analyse__moves).
   */
  private findContainer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('.tview2') ??
      document.querySelector<HTMLElement>('.analyse__moves')
    );
  }

  /**
   * Extract the currently active move from the DOM.
   * Returns null if no move has the `active` class.
   */
  getCurrentMove(): Move | null {
    const container = this.findContainer();
    if (!container) return null;

    const activeEl = container.querySelector<HTMLElement>('move.active');
    if (!activeEl) return null;

    return this.extractMove(container, activeEl);
  }

  /**
   * Start observing the move list for changes.
   * Retries with exponential backoff if the container isn't found.
   */
  start(callback: (move: Move) => void): void {
    this.callback = callback;
    this.tryStart(0);
  }

  /**
   * Stop observing and clean up.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.callback = null;
  }

  private tryStart(attempt: number): void {
    const container = this.findContainer();

    if (container) {
      this.observe(container);
      return;
    }

    // Exponential backoff: 100ms, 200ms, 400ms — up to 3 attempts
    if (attempt < 3) {
      const delay = 100 * Math.pow(2, attempt);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.tryStart(attempt + 1);
      }, delay);
    }
  }

  private observe(container: HTMLElement): void {
    this.observer = new MutationObserver(() => {
      this.handleMutation(container);
    });

    this.observer.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
  }

  private handleMutation(container: HTMLElement): void {
    if (!this.callback) return;

    const activeEl = container.querySelector<HTMLElement>('move.active');
    if (!activeEl) return;

    const move = this.extractMove(container, activeEl);
    this.callback(move);
  }

  /**
   * Extract Move data from an active move element.
   * moveNumber is the 1-indexed position among all <move> elements.
   * FEN is read from the board data attribute or URL hash; empty string as fallback.
   */
  private extractMove(container: HTMLElement, activeEl: HTMLElement): Move {
    const allMoves = Array.from(container.querySelectorAll<HTMLElement>('move'));
    const index = allMoves.indexOf(activeEl);
    const moveNumber = index >= 0 ? index + 1 : 1;

    const fen = this.extractFen();

    return { moveNumber, fen };
  }

  /**
   * Attempt to read the FEN from the page.
   * Tries the board's data attribute and the URL hash.
   * Returns empty string if not available.
   */
  private extractFen(): string {
    // Try board data attribute
    const board = document.querySelector<HTMLElement>('cg-board, .cg-board-wrap');
    if (board) {
      const fen = board.getAttribute('data-fen') ?? board.dataset.fen;
      if (fen) return fen;
    }

    // Try URL hash (Lichess sometimes encodes position info in the hash)
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const decoded = decodeURIComponent(hash.slice(1));
      // Basic FEN-like check: contains slashes typical of FEN
      if (decoded.includes('/') && decoded.split('/').length >= 7) {
        return decoded;
      }
    }

    return '';
  }
}
