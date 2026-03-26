import type { FlowStep, GameSummary, MistakeType, Move, ReviewSession } from './types/index';

export const ALL_STEPS: FlowStep[] = ['opening', 'critical-position', 'mistake-tagging', 'notes', 'summary'];

export function createSession(gameId: string): ReviewSession {
  return {
    gameId,
    createdAt: Date.now(),
    completedSteps: [],
    criticalPositions: [],
    mistakeTags: [],
    notes: [],
    summary: null,
  };
}

export function completeStep(session: ReviewSession, step: FlowStep): ReviewSession {
  if (session.completedSteps.includes(step)) {
    return session;
  }
  return {
    ...session,
    completedSteps: [...session.completedSteps, step],
  };
}

export function getProgress(session: ReviewSession): { completed: number; total: 5 } {
  return {
    completed: session.completedSteps.length,
    total: 5,
  };
}

export function isFinished(session: ReviewSession): boolean {
  return ALL_STEPS.every((step) => session.completedSteps.includes(step));
}

export function addCriticalPosition(session: ReviewSession, move: Move): ReviewSession {
  const criticalPosition = {
    gameId: session.gameId,
    moveNumber: move.moveNumber,
    fen: move.fen,
    timestamp: Date.now(),
  };

  const criticalPositions = session.criticalPositions.filter(
    (cp) => cp.moveNumber !== move.moveNumber,
  );
  criticalPositions.push(criticalPosition);

  return {
    ...session,
    criticalPositions,
  };
}

export function addMistakeTag(session: ReviewSession, move: Move, type: MistakeType): ReviewSession {
  const tag = {
    moveNumber: move.moveNumber,
    fen: move.fen,
    mistakeType: type,
  };

  const existingIndex = session.mistakeTags.findIndex(
    (t) => t.moveNumber === move.moveNumber,
  );

  const mistakeTags =
    existingIndex >= 0
      ? session.mistakeTags.map((t, i) => (i === existingIndex ? tag : t))
      : [...session.mistakeTags, tag];

  return {
    ...session,
    mistakeTags,
  };
}

export function addNote(session: ReviewSession, move: Move, text: string): ReviewSession {
  const note = {
    moveNumber: move.moveNumber,
    fen: move.fen,
    text,
  };

  const existingIndex = session.notes.findIndex(
    (n) => n.moveNumber === move.moveNumber,
  );

  const notes =
    existingIndex >= 0
      ? session.notes.map((n, i) => (i === existingIndex ? note : n))
      : [...session.notes, note];

  return {
    ...session,
    notes,
  };
}

export function updateNote(session: ReviewSession, moveNumber: number, text: string): ReviewSession {
  const existingIndex = session.notes.findIndex(
    (n) => n.moveNumber === moveNumber,
  );

  if (existingIndex < 0) {
    return session;
  }

  const notes = session.notes.map((n, i) =>
    i === existingIndex ? { ...n, text } : n,
  );

  return {
    ...session,
    notes,
  };
}

export function saveSummary(session: ReviewSession, summary: GameSummary): ReviewSession {
  return {
    ...session,
    summary,
  };
}

