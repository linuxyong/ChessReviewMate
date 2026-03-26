import type { FlowStep, GameSummary, MistakeType, MoveReviewData, ReviewSession } from './types/index';

const CRM_PREFIX = '{CRM: ';
const CRM_REGEX = /\{CRM: ([\s\S]*)\}/;

/**
 * Wraps a JSON-serializable object in {CRM: <json>} format.
 */
export function encodeCrmMarker(data: object): string {
  return `${CRM_PREFIX}${JSON.stringify(data)}}`;
}

/**
 * Extracts and parses JSON from a {CRM: ...} marker in a comment string.
 * Returns null if no marker found or if the JSON is malformed.
 */
export function decodeCrmMarker(comment: string): object | null {
  const match = comment.match(CRM_REGEX);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Strips the {CRM: ...} marker from a comment, returning just the user text.
 * Trims leading/trailing whitespace from the result.
 */
export function stripCrmMarker(comment: string): string {
  return comment.replace(CRM_REGEX, '').trim();
}

/**
 * Merges user text with a CRM marker. If userText is empty, returns just the marker.
 * If data is provided, appends the encoded CRM marker after the user text.
 */
export function mergeCommentWithCrm(userText: string, data: object): string {
  const marker = encodeCrmMarker(data);
  const trimmed = userText.trim();
  if (!trimmed) {
    return marker;
  }
  return `${trimmed} ${marker}`;
}

/**
 * Serializes a ReviewSession into a plain object suitable for JSON storage.
 * - `meta` contains session-level data: gameId, createdAt, completedSteps, summary
 * - `moveData` is a record keyed by moveNumber with per-move review data
 */
export function serializeSession(session: ReviewSession): {
  meta: { gameId: string; createdAt: number; completedSteps: FlowStep[]; summary: GameSummary | null };
  moveData: Record<number, MoveReviewData>;
} {
  const moveData: Record<number, MoveReviewData> = {};

  for (const cp of session.criticalPositions) {
    if (!moveData[cp.moveNumber]) {
      moveData[cp.moveNumber] = {};
    }
    moveData[cp.moveNumber].critical = { timestamp: cp.timestamp };
  }

  for (const tag of session.mistakeTags) {
    if (!moveData[tag.moveNumber]) {
      moveData[tag.moveNumber] = {};
    }
    moveData[tag.moveNumber].mistakeType = tag.mistakeType;
  }

  for (const note of session.notes) {
    if (!moveData[note.moveNumber]) {
      moveData[note.moveNumber] = {};
    }
    moveData[note.moveNumber].note = note.text;
  }

  return {
    meta: {
      gameId: session.gameId,
      createdAt: session.createdAt,
      completedSteps: [...session.completedSteps],
      summary: session.summary,
    },
    moveData,
  };
}

const ALL_FLOW_STEPS: FlowStep[] = ['opening', 'critical-position', 'mistake-tagging', 'notes', 'summary'];
const ALL_MISTAKE_TYPES: MistakeType[] = [
  'Blunder', 'Mistake', 'Inaccuracy', 'Tactical Miss', 'Calculation Error',
  'Positional Error', 'Endgame Error', 'Opening Error', 'Time Trouble',
];

/**
 * Deserializes a ReviewSession from the serialized format.
 * Returns null if the data is malformed or missing required fields.
 */
export function deserializeSession(
  meta: any,
  moveData: Record<string, any>,
): ReviewSession | null {
  if (!meta || typeof meta !== 'object') return null;
  if (typeof meta.gameId !== 'string') return null;
  if (typeof meta.createdAt !== 'number') return null;
  if (!Array.isArray(meta.completedSteps)) return null;

  // Validate completedSteps
  const completedSteps: FlowStep[] = [];
  for (const step of meta.completedSteps) {
    if (ALL_FLOW_STEPS.includes(step)) {
      completedSteps.push(step);
    }
  }

  // Validate summary
  let summary: GameSummary | null = null;
  if (meta.summary != null) {
    if (typeof meta.summary !== 'object') return null;
    const s = meta.summary;
    if (
      typeof s.opening !== 'string' ||
      typeof s.middlegame !== 'string' ||
      typeof s.endgame !== 'string' ||
      typeof s.biggestMistake !== 'string' ||
      typeof s.lessonLearned !== 'string'
    ) {
      return null;
    }
    summary = {
      opening: s.opening,
      middlegame: s.middlegame,
      endgame: s.endgame,
      biggestMistake: s.biggestMistake,
      lessonLearned: s.lessonLearned,
    };
  }

  if (!moveData || typeof moveData !== 'object') return null;

  const criticalPositions: ReviewSession['criticalPositions'] = [];
  const mistakeTags: ReviewSession['mistakeTags'] = [];
  const notes: ReviewSession['notes'] = [];

  for (const [key, value] of Object.entries(moveData)) {
    const moveNumber = Number(key);
    if (!Number.isFinite(moveNumber)) continue;
    if (!value || typeof value !== 'object') continue;

    if (value.critical && typeof value.critical.timestamp === 'number') {
      criticalPositions.push({
        gameId: meta.gameId,
        moveNumber,
        fen: '',
        timestamp: value.critical.timestamp,
      });
    }

    if (value.mistakeType && ALL_MISTAKE_TYPES.includes(value.mistakeType)) {
      mistakeTags.push({
        moveNumber,
        fen: '',
        mistakeType: value.mistakeType,
      });
    }

    if (typeof value.note === 'string') {
      notes.push({
        moveNumber,
        fen: '',
        text: value.note,
      });
    }
  }

  return {
    gameId: meta.gameId,
    createdAt: meta.createdAt,
    completedSteps,
    criticalPositions,
    mistakeTags,
    notes,
    summary,
  };
}
