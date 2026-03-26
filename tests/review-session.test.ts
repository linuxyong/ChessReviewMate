import { describe, it, expect } from 'vitest';
import { createSession, completeStep, getProgress, isFinished, addCriticalPosition, addMistakeTag, addNote, updateNote, saveSummary, ALL_STEPS } from '../src/review-session';
import type { FlowStep, GameSummary, MistakeType, Move, ReviewSession } from '../src/types/index';

describe('createSession', () => {
  it('creates a session with the given gameId', () => {
    const session = createSession('game123');
    expect(session.gameId).toBe('game123');
  });

  it('initializes with empty arrays and null summary', () => {
    const session = createSession('abc');
    expect(session.completedSteps).toEqual([]);
    expect(session.criticalPositions).toEqual([]);
    expect(session.mistakeTags).toEqual([]);
    expect(session.notes).toEqual([]);
    expect(session.summary).toBeNull();
  });

  it('sets createdAt to a recent timestamp', () => {
    const before = Date.now();
    const session = createSession('x');
    const after = Date.now();
    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
  });
});

describe('completeStep', () => {
  it('adds a step to completedSteps', () => {
    const session = createSession('g1');
    const updated = completeStep(session, 'opening');
    expect(updated.completedSteps).toEqual(['opening']);
  });

  it('does not duplicate an already completed step', () => {
    const session = createSession('g1');
    const s1 = completeStep(session, 'opening');
    const s2 = completeStep(s1, 'opening');
    expect(s2.completedSteps).toEqual(['opening']);
    expect(s2).toBe(s1); // same reference when no change
  });

  it('returns a new object (immutable)', () => {
    const session = createSession('g1');
    const updated = completeStep(session, 'notes');
    expect(updated).not.toBe(session);
    expect(session.completedSteps).toEqual([]); // original unchanged
  });

  it('can complete all five steps', () => {
    let session = createSession('g1');
    for (const step of ALL_STEPS) {
      session = completeStep(session, step);
    }
    expect(session.completedSteps).toHaveLength(5);
    expect(session.completedSteps).toEqual(ALL_STEPS);
  });
});

describe('getProgress', () => {
  it('returns 0/5 for a new session', () => {
    const session = createSession('g1');
    expect(getProgress(session)).toEqual({ completed: 0, total: 5 });
  });

  it('returns correct count after completing steps', () => {
    let session = createSession('g1');
    session = completeStep(session, 'opening');
    session = completeStep(session, 'summary');
    expect(getProgress(session)).toEqual({ completed: 2, total: 5 });
  });

  it('returns 5/5 when all steps are complete', () => {
    let session = createSession('g1');
    for (const step of ALL_STEPS) {
      session = completeStep(session, step);
    }
    expect(getProgress(session)).toEqual({ completed: 5, total: 5 });
  });
});

describe('isFinished', () => {
  it('returns false for a new session', () => {
    expect(isFinished(createSession('g1'))).toBe(false);
  });

  it('returns false when only some steps are complete', () => {
    let session = createSession('g1');
    session = completeStep(session, 'opening');
    session = completeStep(session, 'notes');
    session = completeStep(session, 'summary');
    expect(isFinished(session)).toBe(false);
  });

  it('returns true when all five steps are complete', () => {
    let session = createSession('g1');
    for (const step of ALL_STEPS) {
      session = completeStep(session, step);
    }
    expect(isFinished(session)).toBe(true);
  });
});

describe('ALL_STEPS', () => {
  it('contains exactly the five expected steps', () => {
    expect(ALL_STEPS).toEqual([
      'opening',
      'critical-position',
      'mistake-tagging',
      'notes',
      'summary',
    ]);
  });
});

describe('addCriticalPosition', () => {
  const move: Move = { moveNumber: 15, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' };

  it('creates a CriticalPosition with correct fields', () => {
    const session = createSession('game1');
    const before = Date.now();
    const updated = addCriticalPosition(session, move);
    const after = Date.now();

    expect(updated.criticalPositions).toHaveLength(1);
    const cp = updated.criticalPositions[0];
    expect(cp.gameId).toBe('game1');
    expect(cp.moveNumber).toBe(15);
    expect(cp.fen).toBe(move.fen);
    expect(cp.timestamp).toBeGreaterThanOrEqual(before);
    expect(cp.timestamp).toBeLessThanOrEqual(after);
  });

  it('returns a new session object (immutable)', () => {
    const session = createSession('game1');
    const updated = addCriticalPosition(session, move);
    expect(updated).not.toBe(session);
    expect(session.criticalPositions).toEqual([]); // original unchanged
  });

  it('replaces existing entry for the same moveNumber (idempotent)', () => {
    const session = createSession('game1');
    const s1 = addCriticalPosition(session, move);
    const s2 = addCriticalPosition(s1, move);

    expect(s2.criticalPositions).toHaveLength(1);
    expect(s2.criticalPositions[0].moveNumber).toBe(15);
    // timestamp should be updated
    expect(s2.criticalPositions[0].timestamp).toBeGreaterThanOrEqual(s1.criticalPositions[0].timestamp);
  });

  it('allows multiple critical positions for different moves', () => {
    const session = createSession('game1');
    const move1: Move = { moveNumber: 10, fen: 'fen1' };
    const move2: Move = { moveNumber: 20, fen: 'fen2' };
    const move3: Move = { moveNumber: 30, fen: 'fen3' };

    let updated = addCriticalPosition(session, move1);
    updated = addCriticalPosition(updated, move2);
    updated = addCriticalPosition(updated, move3);

    expect(updated.criticalPositions).toHaveLength(3);
    expect(updated.criticalPositions.map((cp) => cp.moveNumber)).toEqual([10, 20, 30]);
  });

  it('preserves other session fields', () => {
    let session = createSession('game1');
    session = completeStep(session, 'opening');
    const updated = addCriticalPosition(session, move);

    expect(updated.gameId).toBe('game1');
    expect(updated.completedSteps).toEqual(['opening']);
    expect(updated.mistakeTags).toEqual([]);
    expect(updated.notes).toEqual([]);
    expect(updated.summary).toBeNull();
  });

  it('uses the session gameId, not a custom one', () => {
    const session = createSession('my-game-id');
    const updated = addCriticalPosition(session, move);
    expect(updated.criticalPositions[0].gameId).toBe('my-game-id');
  });
});

describe('addMistakeTag', () => {
  const move: Move = { moveNumber: 12, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' };

  it('creates a MistakeTag with correct fields', () => {
    const session = createSession('game1');
    const updated = addMistakeTag(session, move, 'Blunder');

    expect(updated.mistakeTags).toHaveLength(1);
    const tag = updated.mistakeTags[0];
    expect(tag.moveNumber).toBe(12);
    expect(tag.fen).toBe(move.fen);
    expect(tag.mistakeType).toBe('Blunder');
  });

  it('updates an existing tag for the same moveNumber (update-in-place)', () => {
    const session = createSession('game1');
    const s1 = addMistakeTag(session, move, 'Blunder');
    const s2 = addMistakeTag(s1, move, 'Inaccuracy');

    expect(s2.mistakeTags).toHaveLength(1);
    expect(s2.mistakeTags[0].moveNumber).toBe(12);
    expect(s2.mistakeTags[0].mistakeType).toBe('Inaccuracy');
    expect(s2.mistakeTags[0].fen).toBe(move.fen);
  });

  it('allows multiple tags for different moves', () => {
    const session = createSession('game1');
    const move1: Move = { moveNumber: 5, fen: 'fen1' };
    const move2: Move = { moveNumber: 10, fen: 'fen2' };
    const move3: Move = { moveNumber: 20, fen: 'fen3' };

    let updated = addMistakeTag(session, move1, 'Blunder');
    updated = addMistakeTag(updated, move2, 'Tactical Miss');
    updated = addMistakeTag(updated, move3, 'Endgame Error');

    expect(updated.mistakeTags).toHaveLength(3);
    expect(updated.mistakeTags.map((t) => t.moveNumber)).toEqual([5, 10, 20]);
    expect(updated.mistakeTags.map((t) => t.mistakeType)).toEqual(['Blunder', 'Tactical Miss', 'Endgame Error']);
  });

  it('returns a new session object (immutable)', () => {
    const session = createSession('game1');
    const updated = addMistakeTag(session, move, 'Mistake');

    expect(updated).not.toBe(session);
    expect(session.mistakeTags).toEqual([]); // original unchanged
  });

  it('preserves other session fields', () => {
    let session = createSession('game1');
    session = completeStep(session, 'opening');
    session = addCriticalPosition(session, { moveNumber: 3, fen: 'cpFen' });
    const updated = addMistakeTag(session, move, 'Calculation Error');

    expect(updated.gameId).toBe('game1');
    expect(updated.completedSteps).toEqual(['opening']);
    expect(updated.criticalPositions).toHaveLength(1);
    expect(updated.notes).toEqual([]);
    expect(updated.summary).toBeNull();
  });
});
describe('addNote', () => {
  const move: Move = { moveNumber: 8, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };

  it('creates a new note with correct fields', () => {
    const session = createSession('game1');
    const updated = addNote(session, move, 'Knight is pinned');

    expect(updated.notes).toHaveLength(1);
    const note = updated.notes[0];
    expect(note.moveNumber).toBe(8);
    expect(note.fen).toBe(move.fen);
    expect(note.text).toBe('Knight is pinned');
  });

  it('replaces an existing note for the same moveNumber', () => {
    const session = createSession('game1');
    const s1 = addNote(session, move, 'First thought');
    const s2 = addNote(s1, move, 'Better analysis');

    expect(s2.notes).toHaveLength(1);
    expect(s2.notes[0].moveNumber).toBe(8);
    expect(s2.notes[0].text).toBe('Better analysis');
    expect(s2.notes[0].fen).toBe(move.fen);
  });

  it('returns a new session object (immutable)', () => {
    const session = createSession('game1');
    const updated = addNote(session, move, 'Some note');

    expect(updated).not.toBe(session);
    expect(session.notes).toEqual([]); // original unchanged
  });

  it('supports multi-line text', () => {
    const session = createSession('game1');
    const multiLine = 'Line 1\nLine 2\nLine 3';
    const updated = addNote(session, move, multiLine);

    expect(updated.notes[0].text).toBe(multiLine);
  });

  it('allows notes on different moves', () => {
    const session = createSession('game1');
    const move1: Move = { moveNumber: 5, fen: 'fen1' };
    const move2: Move = { moveNumber: 10, fen: 'fen2' };

    let updated = addNote(session, move1, 'Note on move 5');
    updated = addNote(updated, move2, 'Note on move 10');

    expect(updated.notes).toHaveLength(2);
    expect(updated.notes.map((n) => n.moveNumber)).toEqual([5, 10]);
  });

  it('preserves other session fields', () => {
    let session = createSession('game1');
    session = completeStep(session, 'opening');
    session = addCriticalPosition(session, { moveNumber: 3, fen: 'cpFen' });
    const updated = addNote(session, move, 'A note');

    expect(updated.gameId).toBe('game1');
    expect(updated.completedSteps).toEqual(['opening']);
    expect(updated.criticalPositions).toHaveLength(1);
    expect(updated.mistakeTags).toEqual([]);
    expect(updated.summary).toBeNull();
  });
});

describe('updateNote', () => {
  const move: Move = { moveNumber: 8, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };

  it('updates the text of an existing note', () => {
    let session = createSession('game1');
    session = addNote(session, move, 'Original text');
    const updated = updateNote(session, 8, 'Updated text');

    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].text).toBe('Updated text');
  });

  it('preserves the original FEN when updating', () => {
    let session = createSession('game1');
    session = addNote(session, move, 'Original');
    const updated = updateNote(session, 8, 'New text');

    expect(updated.notes[0].fen).toBe(move.fen);
    expect(updated.notes[0].moveNumber).toBe(8);
  });

  it('returns the session unchanged if moveNumber does not exist', () => {
    const session = createSession('game1');
    const updated = updateNote(session, 99, 'No such move');

    expect(updated).toBe(session); // same reference
  });

  it('returns a new session object when update occurs (immutable)', () => {
    let session = createSession('game1');
    session = addNote(session, move, 'Original');
    const updated = updateNote(session, 8, 'Changed');

    expect(updated).not.toBe(session);
    expect(session.notes[0].text).toBe('Original'); // original unchanged
  });

  it('supports multi-line text in updates', () => {
    let session = createSession('game1');
    session = addNote(session, move, 'Single line');
    const multiLine = 'Line A\nLine B\nLine C';
    const updated = updateNote(session, 8, multiLine);

    expect(updated.notes[0].text).toBe(multiLine);
  });

  it('only updates the targeted note, leaving others intact', () => {
    let session = createSession('game1');
    session = addNote(session, { moveNumber: 5, fen: 'fen5' }, 'Note 5');
    session = addNote(session, { moveNumber: 10, fen: 'fen10' }, 'Note 10');
    const updated = updateNote(session, 5, 'Updated 5');

    expect(updated.notes).toHaveLength(2);
    expect(updated.notes[0].text).toBe('Updated 5');
    expect(updated.notes[1].text).toBe('Note 10');
    expect(updated.notes[1].fen).toBe('fen10');
  });
});

describe('saveSummary', () => {
  const summary: GameSummary = {
    opening: 'Sicilian Defense',
    middlegame: 'Kingside attack',
    endgame: 'Rook endgame',
    biggestMistake: 'Missed Nxf7',
    lessonLearned: 'Calculate forcing moves first',
  };

  it('sets a summary on a new session', () => {
    const session = createSession('game1');
    const updated = saveSummary(session, summary);

    expect(updated.summary).toEqual(summary);
  });

  it('replaces an existing summary', () => {
    const session = createSession('game1');
    const s1 = saveSummary(session, summary);

    const newSummary: GameSummary = {
      opening: 'French Defense',
      middlegame: 'Queenside expansion',
      endgame: 'Bishop vs Knight',
      biggestMistake: 'Premature pawn push',
      lessonLearned: 'Improve pawn structure awareness',
    };
    const s2 = saveSummary(s1, newSummary);

    expect(s2.summary).toEqual(newSummary);
    expect(s2.summary).not.toEqual(summary);
  });

  it('returns a new session object (immutable)', () => {
    const session = createSession('game1');
    const updated = saveSummary(session, summary);

    expect(updated).not.toBe(session);
    expect(session.summary).toBeNull(); // original unchanged
  });

  it('preserves other session fields', () => {
    let session = createSession('game1');
    session = completeStep(session, 'opening');
    session = addCriticalPosition(session, { moveNumber: 10, fen: 'someFen' });
    session = addMistakeTag(session, { moveNumber: 5, fen: 'fen5' }, 'Blunder');
    session = addNote(session, { moveNumber: 8, fen: 'fen8' }, 'A note');

    const updated = saveSummary(session, summary);

    expect(updated.gameId).toBe('game1');
    expect(updated.createdAt).toBe(session.createdAt);
    expect(updated.completedSteps).toEqual(['opening']);
    expect(updated.criticalPositions).toHaveLength(1);
    expect(updated.mistakeTags).toHaveLength(1);
    expect(updated.notes).toHaveLength(1);
  });
});
