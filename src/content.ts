import type { FlowStep, GameSummary, MistakeType, Move, ReviewSession } from './types/index';
import {
  createSession,
  addCriticalPosition,
  addMistakeTag,
  addNote,
  saveSummary,
  completeStep,
} from './review-session';
import { LichessDom, saveSessionToComments, loadSessionFromComments } from './lichess-dom';
import { MoveObserver } from './move-observer';
import { SidebarUI } from './sidebar-ui';

class ContentScriptController {
  private dom: LichessDom;
  private sidebar: SidebarUI;
  private observer: MoveObserver;
  private session: ReviewSession | null = null;
  private currentMove: Move | null = null;

  constructor() {
    this.dom = new LichessDom();
    this.sidebar = new SidebarUI();
    this.observer = new MoveObserver();
  }

  async init(): Promise<void> {
    const gameId = this.dom.getGameId();

    // Inject sidebar into page body
    this.sidebar.inject(document.body);

    // Wire callbacks
    this.wireCallbacks();

    // Start observing move changes
    this.observer.start((move: Move) => this.onMoveChange(move));

    // Try to load existing session from PGN comments
    if (gameId) {
      try {
        const existing = loadSessionFromComments(gameId, this.dom);
        if (existing) {
          this.session = existing;
        }
      } catch (err) {
        this.sidebar.showError('Could not load previous review data.');
      }
    }

    // Render initial state
    this.render();
  }

  private wireCallbacks(): void {
    this.sidebar.onStartReview = () => this.onStartReview();
    this.sidebar.onMarkCritical = () => this.onMarkCritical();
    this.sidebar.onTagMistake = (type: MistakeType) => this.onTagMistake(type);
    this.sidebar.onAddNote = (text: string) => this.onAddNote(text);
    this.sidebar.onSaveSummary = (summary: GameSummary) => this.onSaveSummary(summary);
    this.sidebar.onCompleteStep = (step: FlowStep) => this.onCompleteStep(step);
    this.sidebar.onStepClick = (step: FlowStep) => this.onStepClick(step);
    this.sidebar.onToggle = () => this.onToggleSidebar();
  }

  private render(): void {
    this.sidebar.render(this.session, this.currentMove);
  }

  private async autoSave(): Promise<void> {
    if (!this.session) return;
    try {
      await saveSessionToComments(this.session, this.dom);
    } catch {
      this.sidebar.showError('Save failed. Could not write to study comments.');
    }
  }

  private onStartReview(): void {
    const gameId = this.dom.getGameId() ?? 'unknown';
    this.session = createSession(gameId);
    this.render();
    this.autoSave();
  }

  private onMoveChange(move: Move): void {
    this.currentMove = move;
    this.render();
  }

  private onMarkCritical(): void {
    if (!this.session || !this.currentMove) return;
    this.session = addCriticalPosition(this.session, this.currentMove);
    this.render();
    this.autoSave();
  }

  private onTagMistake(type: MistakeType): void {
    if (!this.session || !this.currentMove) return;
    this.session = addMistakeTag(this.session, this.currentMove, type);
    this.render();
    this.autoSave();
  }

  private onAddNote(text: string): void {
    if (!this.session || !this.currentMove) return;
    this.session = addNote(this.session, this.currentMove, text);
    this.render();
    this.autoSave();
  }

  private onSaveSummary(summary: GameSummary): void {
    if (!this.session) return;
    this.session = saveSummary(this.session, summary);
    this.render();
    this.autoSave();
  }

  private onCompleteStep(step: FlowStep): void {
    if (!this.session) return;
    this.session = completeStep(this.session, step);
    this.render();
    this.autoSave();
  }

  private onStepClick(step: FlowStep): void {
    this.sidebar.currentStep = step;
    this.render();
  }

  private onToggleSidebar(): void {
    // Toggle is already handled by the SidebarUI's toggle button click handler.
    // This callback exists for any additional logic needed on toggle.
  }
}

// Self-executing: initialize when loaded as a content script
const controller = new ContentScriptController();
controller.init();
