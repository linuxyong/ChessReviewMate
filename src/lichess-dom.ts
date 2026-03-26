import type { MoveReviewData, ReviewSession } from './types/index';
import {
  encodeCrmMarker,
  decodeCrmMarker,
  stripCrmMarker,
  mergeCommentWithCrm,
  serializeSession,
  deserializeSession,
} from './pgn-comment-storage';

/**
 * Provides DOM interaction with the Lichess Study page to read/write PGN comments.
 * Designed to run as a content script with direct DOM access on lichess.org/study/* pages.
 */
export class LichessDom {
  /**
   * Extract the chapter ID from the current URL.
   * Lichess study URLs: /study/{studyId}/{chapterId}
   * Returns the chapterId as the gameId, or null if not found.
   */
  getGameId(): string | null {
    const match = window.location.pathname.match(/\/study\/[^/]+\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Find the move list container element in the Lichess DOM.
   */
  private getMoveListContainer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('.tview2') ??
      document.querySelector<HTMLElement>('.analyse__moves')
    );
  }

  /**
   * Find all move elements in the move list.
   */
  private getMoveElements(): HTMLElement[] {
    const container = this.getMoveListContainer();
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>('move'));
  }

  /**
   * Find the move element for a given moveNumber (1-indexed position in the move list).
   */
  private getMoveElement(moveNumber: number): HTMLElement | null {
    const moves = this.getMoveElements();
    if (moveNumber < 1 || moveNumber > moves.length) return null;
    return moves[moveNumber - 1];
  }

  /**
   * Find the comment element associated with a move element.
   * Comments appear as sibling elements with class 'comment' after the move.
   */
  private getCommentElement(moveEl: HTMLElement): HTMLElement | null {
    let sibling = moveEl.nextElementSibling;
    while (sibling) {
      if (sibling.classList.contains('comment')) {
        return sibling as HTMLElement;
      }
      // Stop if we hit another move element
      if (sibling.tagName.toLowerCase() === 'move') break;
      sibling = sibling.nextElementSibling;
    }
    return null;
  }

  /**
   * Read the comment text for a specific move from the DOM.
   * Returns null if no comment is found.
   */
  readMoveComment(moveNumber: number): string | null {
    const moveEl = this.getMoveElement(moveNumber);
    if (!moveEl) return null;

    const commentEl = this.getCommentElement(moveEl);
    if (!commentEl) return null;

    return commentEl.textContent?.trim() || null;
  }

  /**
   * Write a comment to a specific move by interacting with the Lichess comment UI.
   * - Clicks the move to select it
   * - Finds or opens the comment textarea
   * - Sets the comment text
   * - Triggers input/change events so Lichess saves it
   */
  async writeMoveComment(moveNumber: number, commentText: string): Promise<void> {
    if (this.isReadOnly()) {
      throw new Error('Cannot write comments: study is read-only.');
    }

    const moveEl = this.getMoveElement(moveNumber);
    if (!moveEl) {
      throw new Error(`Move element not found for move ${moveNumber}.`);
    }

    // Click the move to select it
    moveEl.click();

    // Wait briefly for Lichess to update the UI
    await this.delay(50);

    // Find the comment textarea — Lichess shows it in the analysis area
    let textarea = document.querySelector<HTMLTextAreaElement>(
      '.analyse__tools .comment-text, .study__comments textarea, textarea.comment'
    );

    // If no textarea found, try clicking the comment button to open it
    if (!textarea) {
      const commentBtn = document.querySelector<HTMLElement>(
        '.analyse__tools .comment-button, button[data-act="comment"]'
      );
      if (commentBtn) {
        commentBtn.click();
        await this.delay(100);
        textarea = document.querySelector<HTMLTextAreaElement>(
          '.analyse__tools .comment-text, .study__comments textarea, textarea.comment'
        );
      }
    }

    if (!textarea) {
      throw new Error(
        `Comment textarea not accessible for move ${moveNumber}. The comment area may be unavailable.`
      );
    }

    // Set the value and dispatch events so Lichess picks up the change
    textarea.value = commentText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Read all comments from all moves in the current chapter.
   * Returns a Map of moveNumber → comment text.
   */
  readAllComments(): Map<number, string> {
    const result = new Map<number, string>();
    const moves = this.getMoveElements();

    for (let i = 0; i < moves.length; i++) {
      const moveNumber = i + 1;
      const commentEl = this.getCommentElement(moves[i]);
      if (commentEl) {
        const text = commentEl.textContent?.trim();
        if (text) {
          result.set(moveNumber, text);
        }
      }
    }

    return result;
  }

  /**
   * Check if the current study is read-only (user can't edit).
   * Lichess marks read-only studies by not showing edit controls.
   */
  isReadOnly(): boolean {
    // If there's no comment form/button and no study write controls, it's read-only
    const writeIndicators = document.querySelector(
      '.study__buttons .study__write, .analyse__tools .comment-button, button[data-act="comment"]'
    );
    return writeIndicators === null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


/**
 * Serialize a ReviewSession and write CRM markers to the appropriate move comments,
 * preserving existing non-CRM text in each comment.
 */
export async function saveSessionToComments(
  session: ReviewSession,
  dom: LichessDom = new LichessDom(),
): Promise<void> {
  if (dom.isReadOnly()) {
    throw new Error('Cannot save: study is read-only.');
  }

  const { meta, moveData } = serializeSession(session);

  // Determine all move numbers that need writing
  const moveNumbers = new Set<number>(
    Object.keys(moveData).map(Number)
  );

  // Session-level meta is stored on move 1
  moveNumbers.add(1);

  for (const moveNumber of moveNumbers) {
    const existingComment = dom.readMoveComment(moveNumber) ?? '';
    const userText = stripCrmMarker(existingComment);

    // Build the CRM data for this move
    const crmData: Record<string, unknown> = {};

    // Move 1 gets the session meta
    if (moveNumber === 1) {
      crmData.meta = meta;
    }

    // Add per-move review data if present
    const perMove = moveData[moveNumber];
    if (perMove) {
      if (perMove.critical) crmData.critical = perMove.critical;
      if (perMove.mistakeType) crmData.mistakeType = perMove.mistakeType;
      if (perMove.note !== undefined) crmData.note = perMove.note;
    }

    // Only write if there's CRM data to store
    if (Object.keys(crmData).length === 0) continue;

    const newComment = mergeCommentWithCrm(userText, crmData);

    try {
      await dom.writeMoveComment(moveNumber, newComment);
    } catch (err) {
      // Skip moves where DOM interaction fails, continue with others
      console.warn(`Failed to write comment for move ${moveNumber}:`, err);
    }
  }
}

/**
 * Read all comments from the DOM, extract CRM markers, and reconstruct a ReviewSession.
 * Returns null if no valid session data is found.
 */
export function loadSessionFromComments(
  gameId: string,
  dom: LichessDom = new LichessDom(),
): ReviewSession | null {
  const allComments = dom.readAllComments();

  if (allComments.size === 0) return null;

  // Extract session meta from move 1
  const move1Comment = allComments.get(1);
  if (!move1Comment) return null;

  const move1Data = decodeCrmMarker(move1Comment);
  if (!move1Data || typeof move1Data !== 'object') return null;

  const metaObj = (move1Data as Record<string, unknown>).meta;
  if (!metaObj || typeof metaObj !== 'object') return null;

  // Build moveData from all comments
  const moveData: Record<number, MoveReviewData> = {};

  for (const [moveNumber, commentText] of allComments) {
    const decoded = decodeCrmMarker(commentText);
    if (!decoded || typeof decoded !== 'object') continue;

    const d = decoded as Record<string, unknown>;
    const reviewData: MoveReviewData = {};

    if (d.critical && typeof d.critical === 'object') {
      reviewData.critical = d.critical as { timestamp: number };
    }
    if (typeof d.mistakeType === 'string') {
      reviewData.mistakeType = d.mistakeType as MoveReviewData['mistakeType'];
    }
    if (typeof d.note === 'string') {
      reviewData.note = d.note;
    }

    if (Object.keys(reviewData).length > 0) {
      moveData[moveNumber] = reviewData;
    }
  }

  return deserializeSession(metaObj as any, moveData);
}
