export type FlowStep = 'opening' | 'critical-position' | 'mistake-tagging' | 'notes' | 'summary';

export type MistakeType =
  | 'Blunder'
  | 'Mistake'
  | 'Inaccuracy'
  | 'Tactical Miss'
  | 'Calculation Error'
  | 'Positional Error'
  | 'Endgame Error'
  | 'Opening Error'
  | 'Time Trouble';

export interface Move {
  moveNumber: number;
  fen: string;
}

export interface CriticalPosition {
  gameId: string;
  moveNumber: number;
  fen: string;
  timestamp: number;
}

export interface MistakeTag {
  moveNumber: number;
  fen: string;
  mistakeType: MistakeType;
}

export interface Note {
  moveNumber: number;
  fen: string;
  text: string;
}

export interface GameSummary {
  opening: string;
  middlegame: string;
  endgame: string;
  biggestMistake: string;
  lessonLearned: string;
}

export interface ReviewSession {
  gameId: string;
  createdAt: number;
  completedSteps: FlowStep[];
  criticalPositions: CriticalPosition[];
  mistakeTags: MistakeTag[];
  notes: Note[];
  summary: GameSummary | null;
}

export interface MoveReviewData {
  critical?: { timestamp: number };
  mistakeType?: MistakeType;
  note?: string;
}

export interface PgnCommentPayload {
  sessionMeta: {
    gameId: string;
    createdAt: number;
    completedSteps: FlowStep[];
  };
  summary: GameSummary | null;
  moves: Map<number, MoveReviewData>;
}
