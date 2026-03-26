import { describe, it, expect } from 'vitest';
import {
  encodeCrmMarker,
  decodeCrmMarker,
  stripCrmMarker,
  mergeCommentWithCrm,
  serializeSession,
  deserializeSession,
} from '../src/pgn-comment-storage';
import type { ReviewSession, GameSummary } from '../src/types/index';

describe('encodeCrmMarker', () => {
  it('encodes a simple object', () => {
    expect(encodeCrmMarker({ note: 'hello' })).toBe('{CRM: {"note":"hello"}}');
  });

  it('encodes an empty object', () => {
    expect(encodeCrmMarker({})).toBe('{CRM: {}}');
  });

  it('encodes nested objects', () => {
    const data = { critical: { timestamp: 1700000000000 }, mistakeType: 'Blunder' };
    const result = encodeCrmMarker(data);
    expect(result).toBe('{CRM: {"critical":{"timestamp":1700000000000},"mistakeType":"Blunder"}}');
  });

  it('encodes arrays', () => {
    expect(encodeCrmMarker({ steps: ['a', 'b'] })).toBe('{CRM: {"steps":["a","b"]}}');
  });

  it('encodes objects with special characters in values', () => {
    const data = { note: 'Missed Nxf7! "critical" move' };
    const result = encodeCrmMarker(data);
    const decoded = decodeCrmMarker(result);
    expect(decoded).toEqual(data);
  });
});

describe('decodeCrmMarker', () => {
  it('decodes a pure CRM marker', () => {
    const comment = '{CRM: {"note":"hello"}}';
    expect(decodeCrmMarker(comment)).toEqual({ note: 'hello' });
  });

  it('decodes a CRM marker with nested data', () => {
    const comment = '{CRM: {"critical":{"timestamp":1700000000000},"mistakeType":"Blunder"}}';
    expect(decodeCrmMarker(comment)).toEqual({
      critical: { timestamp: 1700000000000 },
      mistakeType: 'Blunder',
    });
  });

  it('returns null for comments without CRM marker', () => {
    expect(decodeCrmMarker('This is a normal comment')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeCrmMarker('')).toBeNull();
  });

  it('returns null for malformed JSON in CRM marker', () => {
    expect(decodeCrmMarker('{CRM: not-json}')).toBeNull();
  });

  it('returns null when CRM marker contains a primitive (not object)', () => {
    expect(decodeCrmMarker('{CRM: 42}')).toBeNull();
    expect(decodeCrmMarker('{CRM: "string"}')).toBeNull();
    expect(decodeCrmMarker('{CRM: true}')).toBeNull();
    expect(decodeCrmMarker('{CRM: null}')).toBeNull();
  });

  it('decodes CRM marker mixed with other text (marker at end)', () => {
    const comment = 'Good move here {CRM: {"note":"analysis"}}';
    expect(decodeCrmMarker(comment)).toEqual({ note: 'analysis' });
  });

  it('decodes CRM marker mixed with other text (marker at start)', () => {
    const comment = '{CRM: {"note":"analysis"}} some trailing text';
    expect(decodeCrmMarker(comment)).toEqual({ note: 'analysis' });
  });

  it('decodes an empty object marker', () => {
    expect(decodeCrmMarker('{CRM: {}}')).toEqual({});
  });

  it('decodes arrays inside CRM marker', () => {
    const comment = '{CRM: {"items":[1,2,3]}}';
    expect(decodeCrmMarker(comment)).toEqual({ items: [1, 2, 3] });
  });
});

describe('stripCrmMarker', () => {
  it('strips CRM marker from a mixed comment', () => {
    expect(stripCrmMarker('Good move {CRM: {"note":"x"}}')).toBe('Good move');
  });

  it('returns empty string when comment is only a CRM marker', () => {
    expect(stripCrmMarker('{CRM: {"note":"x"}}')).toBe('');
  });

  it('returns original text when no CRM marker present', () => {
    expect(stripCrmMarker('Just a normal comment')).toBe('Just a normal comment');
  });

  it('returns empty string for empty input', () => {
    expect(stripCrmMarker('')).toBe('');
  });

  it('preserves text before and after CRM marker', () => {
    expect(stripCrmMarker('before {CRM: {}} after')).toBe('before  after');
  });
});

describe('mergeCommentWithCrm', () => {
  it('merges user text with CRM data', () => {
    const result = mergeCommentWithCrm('Good move', { note: 'analysis' });
    expect(result).toBe('Good move {CRM: {"note":"analysis"}}');
  });

  it('returns just the marker when user text is empty', () => {
    const result = mergeCommentWithCrm('', { note: 'analysis' });
    expect(result).toBe('{CRM: {"note":"analysis"}}');
  });

  it('returns just the marker when user text is whitespace', () => {
    const result = mergeCommentWithCrm('   ', { note: 'x' });
    expect(result).toBe('{CRM: {"note":"x"}}');
  });

  it('trims user text before merging', () => {
    const result = mergeCommentWithCrm('  hello  ', { a: 1 });
    expect(result).toBe('hello {CRM: {"a":1}}');
  });

  it('round-trips: decode(merge(text, data)) returns data', () => {
    const data = { critical: { timestamp: 123 } };
    const merged = mergeCommentWithCrm('User comment', data);
    expect(decodeCrmMarker(merged)).toEqual(data);
  });

  it('round-trips: strip(merge(text, data)) returns text', () => {
    const merged = mergeCommentWithCrm('User comment', { x: 1 });
    expect(stripCrmMarker(merged)).toBe('User comment');
  });
});


function makeSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    gameId: 'game123',
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
  middlegame: 'Tactical battle on kingside',
  endgame: 'Rook endgame conversion',
  biggestMistake: 'Missed Nxf7',
  lessonLearned: 'Calculate forcing moves first',
};

describe('serializeSession', () => {
  it('serializes a session with all data types', () => {
    const session = makeSession({
      completedSteps: ['opening', 'critical-position'],
      criticalPositions: [
        { gameId: 'game123', moveNumber: 10, fen: 'fen10', timestamp: 111 },
      ],
      mistakeTags: [
        { moveNumber: 10, fen: 'fen10', mistakeType: 'Blunder' },
        { moveNumber: 15, fen: 'fen15', mistakeType: 'Inaccuracy' },
      ],
      notes: [
        { moveNumber: 10, fen: 'fen10', text: 'Bad move' },
        { moveNumber: 20, fen: 'fen20', text: 'Good idea' },
      ],
      summary: sampleSummary,
    });

    const result = serializeSession(session);

    expect(result.meta.gameId).toBe('game123');
    expect(result.meta.createdAt).toBe(1700000000000);
    expect(result.meta.completedSteps).toEqual(['opening', 'critical-position']);
    expect(result.meta.summary).toEqual(sampleSummary);

    // Move 10 has all three data types
    expect(result.moveData[10]).toEqual({
      critical: { timestamp: 111 },
      mistakeType: 'Blunder',
      note: 'Bad move',
    });
    // Move 15 has only mistakeType
    expect(result.moveData[15]).toEqual({ mistakeType: 'Inaccuracy' });
    // Move 20 has only note
    expect(result.moveData[20]).toEqual({ note: 'Good idea' });
  });

  it('serializes an empty session', () => {
    const session = makeSession();
    const result = serializeSession(session);

    expect(result.meta.gameId).toBe('game123');
    expect(result.meta.completedSteps).toEqual([]);
    expect(result.meta.summary).toBeNull();
    expect(result.moveData).toEqual({});
  });

  it('serializes a session with no summary', () => {
    const session = makeSession({
      criticalPositions: [
        { gameId: 'game123', moveNumber: 5, fen: 'fen5', timestamp: 999 },
      ],
    });
    const result = serializeSession(session);

    expect(result.meta.summary).toBeNull();
    expect(result.moveData[5]).toEqual({ critical: { timestamp: 999 } });
  });

  it('does not mutate the original completedSteps array', () => {
    const steps: ReviewSession['completedSteps'] = ['opening'];
    const session = makeSession({ completedSteps: steps });
    const result = serializeSession(session);

    result.meta.completedSteps.push('notes');
    expect(session.completedSteps).toEqual(['opening']);
  });
});

describe('deserializeSession', () => {
  it('deserializes valid data', () => {
    const meta = {
      gameId: 'abc',
      createdAt: 1700000000000,
      completedSteps: ['opening', 'notes'],
      summary: sampleSummary,
    };
    const moveData = {
      '10': { critical: { timestamp: 111 }, mistakeType: 'Blunder', note: 'Bad' },
      '20': { note: 'Good idea' },
    };

    const result = deserializeSession(meta, moveData);

    expect(result).not.toBeNull();
    expect(result!.gameId).toBe('abc');
    expect(result!.createdAt).toBe(1700000000000);
    expect(result!.completedSteps).toEqual(['opening', 'notes']);
    expect(result!.summary).toEqual(sampleSummary);
    expect(result!.criticalPositions).toEqual([
      { gameId: 'abc', moveNumber: 10, fen: '', timestamp: 111 },
    ]);
    expect(result!.mistakeTags).toEqual([
      { moveNumber: 10, fen: '', mistakeType: 'Blunder' },
    ]);
    expect(result!.notes).toHaveLength(2);
    expect(result!.notes.find(n => n.moveNumber === 10)!.text).toBe('Bad');
    expect(result!.notes.find(n => n.moveNumber === 20)!.text).toBe('Good idea');
  });

  it('round-trip: deserialize(serialize(session)) produces equivalent session', () => {
    const session = makeSession({
      completedSteps: ['opening', 'critical-position', 'mistake-tagging'],
      criticalPositions: [
        { gameId: 'game123', moveNumber: 5, fen: 'fen5', timestamp: 100 },
        { gameId: 'game123', moveNumber: 12, fen: 'fen12', timestamp: 200 },
      ],
      mistakeTags: [
        { moveNumber: 5, fen: 'fen5', mistakeType: 'Tactical Miss' },
      ],
      notes: [
        { moveNumber: 12, fen: 'fen12', text: 'Should have played Nf3' },
      ],
      summary: sampleSummary,
    });

    const { meta, moveData } = serializeSession(session);
    const restored = deserializeSession(meta, moveData);

    expect(restored).not.toBeNull();
    expect(restored!.gameId).toBe(session.gameId);
    expect(restored!.createdAt).toBe(session.createdAt);
    expect(restored!.completedSteps).toEqual(session.completedSteps);
    expect(restored!.summary).toEqual(session.summary);

    // Critical positions match (FEN is lost in serialization, restored as '')
    expect(restored!.criticalPositions).toHaveLength(2);
    expect(restored!.criticalPositions.map(cp => cp.moveNumber).sort((a, b) => a - b)).toEqual([5, 12]);
    expect(restored!.criticalPositions.map(cp => cp.timestamp).sort((a, b) => a - b)).toEqual([100, 200]);

    // Mistake tags match
    expect(restored!.mistakeTags).toHaveLength(1);
    expect(restored!.mistakeTags[0].moveNumber).toBe(5);
    expect(restored!.mistakeTags[0].mistakeType).toBe('Tactical Miss');

    // Notes match
    expect(restored!.notes).toHaveLength(1);
    expect(restored!.notes[0].moveNumber).toBe(12);
    expect(restored!.notes[0].text).toBe('Should have played Nf3');
  });

  it('returns null for null meta', () => {
    expect(deserializeSession(null, {})).toBeNull();
  });

  it('returns null for missing gameId', () => {
    expect(deserializeSession({ createdAt: 1, completedSteps: [] }, {})).toBeNull();
  });

  it('returns null for missing createdAt', () => {
    expect(deserializeSession({ gameId: 'x', completedSteps: [] }, {})).toBeNull();
  });

  it('returns null for missing completedSteps', () => {
    expect(deserializeSession({ gameId: 'x', createdAt: 1 }, {})).toBeNull();
  });

  it('returns null for non-object meta', () => {
    expect(deserializeSession('bad', {})).toBeNull();
    expect(deserializeSession(42, {})).toBeNull();
  });

  it('returns null for null moveData', () => {
    expect(deserializeSession({ gameId: 'x', createdAt: 1, completedSteps: [] }, null as any)).toBeNull();
  });

  it('returns null for malformed summary', () => {
    const meta = {
      gameId: 'x',
      createdAt: 1,
      completedSteps: [],
      summary: { opening: 'ok' }, // missing fields
    };
    expect(deserializeSession(meta, {})).toBeNull();
  });

  it('filters invalid completedSteps values', () => {
    const meta = {
      gameId: 'x',
      createdAt: 1,
      completedSteps: ['opening', 'invalid-step', 'notes'],
    };
    const result = deserializeSession(meta, {});
    expect(result).not.toBeNull();
    expect(result!.completedSteps).toEqual(['opening', 'notes']);
  });

  it('skips moveData entries with invalid move numbers', () => {
    const meta = { gameId: 'x', createdAt: 1, completedSteps: [] };
    const moveData = {
      'abc': { note: 'bad key' },
      '5': { note: 'good' },
    };
    const result = deserializeSession(meta, moveData);
    expect(result).not.toBeNull();
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes[0].moveNumber).toBe(5);
  });

  it('skips moveData entries with invalid mistakeType', () => {
    const meta = { gameId: 'x', createdAt: 1, completedSteps: [] };
    const moveData = {
      '5': { mistakeType: 'NotARealType' },
    };
    const result = deserializeSession(meta, moveData);
    expect(result).not.toBeNull();
    expect(result!.mistakeTags).toHaveLength(0);
  });

  it('handles session with null summary correctly', () => {
    const meta = {
      gameId: 'x',
      createdAt: 1,
      completedSteps: ['opening'],
      summary: null,
    };
    const result = deserializeSession(meta, {});
    expect(result).not.toBeNull();
    expect(result!.summary).toBeNull();
  });
});
