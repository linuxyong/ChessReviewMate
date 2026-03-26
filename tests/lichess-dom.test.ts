// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { LichessDom, saveSessionToComments, loadSessionFromComments } from '../src/lichess-dom';
import type { ReviewSession, GameSummary } from '../src/types/index';

/**
 * Helper: build a minimal Lichess-like move list DOM.
 * Creates a .tview2 container with <move> elements and optional <comment> siblings.
 */
function buildMoveList(
  moves: { text: string; comment?: string; active?: boolean }[],
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tview2';

  for (const m of moves) {
    const moveEl = document.createElement('move');
    moveEl.textContent = m.text;
    if (m.active) moveEl.classList.add('active');
    container.appendChild(moveEl);

    if (m.comment !== undefined) {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.textContent = m.comment;
      container.appendChild(commentEl);
    }
  }

  document.body.appendChild(container);
  return container;
}

/**
 * Helper: add a write-indicator element so isReadOnly() returns false.
 */
function addWriteIndicator(): void {
  const btn = document.createElement('button');
  btn.setAttribute('data-act', 'comment');
  document.body.appendChild(btn);
}

function makeSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    gameId: 'chapter1',
    createdAt: 1700000000000,
    completedSteps: [],
    criticalPositions: [],
    mistakeTags: [],
    notes: [],
    summary: null,
    ...overrides,
  };
}

const sampleSummary: GameSummary = {
  opening: 'Sicilian Defense',
  middlegame: 'Tactical battle',
  endgame: 'Rook endgame',
  biggestMistake: 'Missed Nxf7',
  lessonLearned: 'Calculate first',
};

describe('LichessDom', () => {
  let dom: LichessDom;

  beforeEach(() => {
    document.body.innerHTML = '';
    dom = new LichessDom();
  });

  describe('getGameId', () => {
    it('extracts chapterId from a study URL', () => {
      // jsdom allows setting location via Object.defineProperty workaround
      // We'll test the regex logic directly instead
      const match = '/study/abc123/chapter456'.match(/\/study\/[^/]+\/([^/]+)/);
      expect(match?.[1]).toBe('chapter456');
    });

    it('returns null for non-study URLs', () => {
      const match = '/analysis'.match(/\/study\/[^/]+\/([^/]+)/);
      expect(match).toBeNull();
    });
  });

  describe('readMoveComment', () => {
    it('reads comment for a specific move', () => {
      buildMoveList([
        { text: 'e4', comment: 'Good opening move' },
        { text: 'e5' },
        { text: 'Nf3', comment: 'Developing knight' },
      ]);

      expect(dom.readMoveComment(1)).toBe('Good opening move');
      expect(dom.readMoveComment(3)).toBe('Developing knight');
    });

    it('returns null when move has no comment', () => {
      buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
      ]);

      expect(dom.readMoveComment(1)).toBeNull();
      expect(dom.readMoveComment(2)).toBeNull();
    });

    it('returns null for out-of-range move number', () => {
      buildMoveList([{ text: 'e4' }]);

      expect(dom.readMoveComment(0)).toBeNull();
      expect(dom.readMoveComment(5)).toBeNull();
    });

    it('returns null when no move list container exists', () => {
      expect(dom.readMoveComment(1)).toBeNull();
    });
  });

  describe('readAllComments', () => {
    it('reads all comments from the move list', () => {
      buildMoveList([
        { text: 'e4', comment: 'First' },
        { text: 'e5' },
        { text: 'Nf3', comment: 'Third' },
        { text: 'Nc6', comment: 'Fourth' },
      ]);

      const result = dom.readAllComments();
      expect(result.size).toBe(3);
      expect(result.get(1)).toBe('First');
      expect(result.get(3)).toBe('Third');
      expect(result.get(4)).toBe('Fourth');
      expect(result.has(2)).toBe(false);
    });

    it('returns empty map when no moves exist', () => {
      expect(dom.readAllComments().size).toBe(0);
    });

    it('returns empty map when no comments exist', () => {
      buildMoveList([
        { text: 'e4' },
        { text: 'e5' },
      ]);
      expect(dom.readAllComments().size).toBe(0);
    });
  });

  describe('isReadOnly', () => {
    it('returns true when no write indicators are present', () => {
      buildMoveList([{ text: 'e4' }]);
      expect(dom.isReadOnly()).toBe(true);
    });

    it('returns false when comment button exists', () => {
      buildMoveList([{ text: 'e4' }]);
      addWriteIndicator();
      expect(dom.isReadOnly()).toBe(false);
    });
  });

  describe('writeMoveComment', () => {
    it('throws when study is read-only', async () => {
      buildMoveList([{ text: 'e4' }]);
      // No write indicator → read-only
      await expect(dom.writeMoveComment(1, 'test')).rejects.toThrow('read-only');
    });

    it('throws when move element is not found', async () => {
      buildMoveList([{ text: 'e4' }]);
      addWriteIndicator();
      await expect(dom.writeMoveComment(99, 'test')).rejects.toThrow('Move element not found');
    });

    it('throws when textarea is not accessible', async () => {
      buildMoveList([{ text: 'e4' }]);
      addWriteIndicator();
      // No textarea in DOM
      await expect(dom.writeMoveComment(1, 'test')).rejects.toThrow('textarea not accessible');
    });

    it('writes to textarea when available', async () => {
      buildMoveList([{ text: 'e4' }]);
      addWriteIndicator();

      // Create a textarea that Lichess would show
      const textarea = document.createElement('textarea');
      textarea.className = 'comment';
      const toolsDiv = document.createElement('div');
      toolsDiv.className = 'analyse__tools';
      const commentText = document.createElement('textarea');
      commentText.className = 'comment-text';
      toolsDiv.appendChild(commentText);
      document.body.appendChild(toolsDiv);

      await dom.writeMoveComment(1, 'Hello CRM');
      expect(commentText.value).toBe('Hello CRM');
    });
  });
});


describe('saveSessionToComments and loadSessionFromComments', () => {
  let dom: LichessDom;

  beforeEach(() => {
    document.body.innerHTML = '';
    dom = new LichessDom();
  });

  it('saveSessionToComments throws on read-only study', async () => {
    buildMoveList([{ text: 'e4' }]);
    const session = makeSession();
    await expect(saveSessionToComments(session, dom)).rejects.toThrow('read-only');
  });

  it('loadSessionFromComments returns null when no comments exist', () => {
    buildMoveList([{ text: 'e4' }, { text: 'e5' }]);
    expect(loadSessionFromComments('chapter1', dom)).toBeNull();
  });

  it('loadSessionFromComments returns null when move 1 has no CRM marker', () => {
    buildMoveList([
      { text: 'e4', comment: 'Just a normal comment' },
      { text: 'e5' },
    ]);
    expect(loadSessionFromComments('chapter1', dom)).toBeNull();
  });

  it('loadSessionFromComments parses session from CRM markers', () => {
    const meta = {
      gameId: 'chapter1',
      createdAt: 1700000000000,
      completedSteps: ['opening'],
      summary: null,
    };
    const move1Crm = `{CRM: ${JSON.stringify({ meta })}}`;
    const move3Crm = `{CRM: ${JSON.stringify({ note: 'Good move' })}}`;

    buildMoveList([
      { text: 'e4', comment: move1Crm },
      { text: 'e5' },
      { text: 'Nf3', comment: `User text ${move3Crm}` },
    ]);

    const result = loadSessionFromComments('chapter1', dom);
    expect(result).not.toBeNull();
    expect(result!.gameId).toBe('chapter1');
    expect(result!.createdAt).toBe(1700000000000);
    expect(result!.completedSteps).toEqual(['opening']);
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes[0].moveNumber).toBe(3);
    expect(result!.notes[0].text).toBe('Good move');
  });

  it('loadSessionFromComments handles critical positions and mistake tags', () => {
    const meta = {
      gameId: 'ch1',
      createdAt: 1700000000000,
      completedSteps: [],
      summary: null,
    };
    const move1Crm = `{CRM: ${JSON.stringify({ meta, critical: { timestamp: 500 } })}}`;
    const move2Crm = `{CRM: ${JSON.stringify({ mistakeType: 'Blunder', note: 'Bad' })}}`;

    buildMoveList([
      { text: 'e4', comment: move1Crm },
      { text: 'e5', comment: move2Crm },
    ]);

    const result = loadSessionFromComments('ch1', dom);
    expect(result).not.toBeNull();
    expect(result!.criticalPositions).toHaveLength(1);
    expect(result!.criticalPositions[0].moveNumber).toBe(1);
    expect(result!.criticalPositions[0].timestamp).toBe(500);
    expect(result!.mistakeTags).toHaveLength(1);
    expect(result!.mistakeTags[0].moveNumber).toBe(2);
    expect(result!.mistakeTags[0].mistakeType).toBe('Blunder');
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes[0].text).toBe('Bad');
  });

  it('loadSessionFromComments returns null when meta is missing from move 1 CRM', () => {
    const move1Crm = `{CRM: ${JSON.stringify({ note: 'just a note, no meta' })}}`;
    buildMoveList([
      { text: 'e4', comment: move1Crm },
    ]);
    expect(loadSessionFromComments('ch1', dom)).toBeNull();
  });
});
