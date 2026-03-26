import type { ReviewSession, Move, FlowStep, MistakeType, GameSummary } from './types/index';

const ALL_MISTAKE_TYPES: MistakeType[] = [
  'Blunder',
  'Mistake',
  'Inaccuracy',
  'Tactical Miss',
  'Calculation Error',
  'Positional Error',
  'Endgame Error',
  'Opening Error',
  'Time Trouble',
];
import { ALL_STEPS } from './review-session';

const STEP_LABELS: Record<FlowStep, string> = {
  'opening': 'Opening',
  'critical-position': 'Critical Position',
  'mistake-tagging': 'Mistake Tagging',
  'notes': 'Notes',
  'summary': 'Summary',
};

export class SidebarUI {
  private container: HTMLElement | null = null;
  private collapsed: boolean = false;
  currentStep: FlowStep | null = null;

  onStartReview: (() => void) | null = null;
  onToggle: (() => void) | null = null;
  onStepClick: ((step: FlowStep) => void) | null = null;
  onCompleteStep: ((step: FlowStep) => void) | null = null;
  onMarkCritical: (() => void) | null = null;
  onTagMistake: ((type: MistakeType) => void) | null = null;
  onAddNote: ((text: string) => void) | null = null;
  onSaveSummary: ((summary: GameSummary) => void) | null = null;

  inject(parent: HTMLElement): void {
    const sidebar = document.createElement('div');
    sidebar.className = 'crm-sidebar';

    // Header
    const header = document.createElement('div');
    header.className = 'crm-header';

    const title = document.createElement('span');
    title.className = 'crm-title';
    title.textContent = 'ChessReviewMate';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'crm-toggle-btn';
    toggleBtn.textContent = '◀';
    toggleBtn.addEventListener('click', () => {
      if (this.collapsed) {
        this.expand();
      } else {
        this.collapse();
      }
      this.onToggle?.();
    });

    header.appendChild(title);
    header.appendChild(toggleBtn);

    // Content area
    const content = document.createElement('div');
    content.className = 'crm-content';

    sidebar.appendChild(header);
    sidebar.appendChild(content);
    parent.appendChild(sidebar);

    this.container = sidebar;

    // Render initial state
    this.render(null, null);
  }

  collapse(): void {
    if (!this.container) return;
    this.collapsed = true;
    this.container.classList.add('crm-collapsed');
    const toggleBtn = this.container.querySelector('.crm-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = '▶';
  }

  expand(): void {
    if (!this.container) return;
    this.collapsed = false;
    this.container.classList.remove('crm-collapsed');
    const toggleBtn = this.container.querySelector('.crm-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = '◀';
  }

  isCollapsed(): boolean {
    return this.collapsed;
  }

  render(session: ReviewSession | null, _currentMove: Move | null): void {
    const content = this.container?.querySelector('.crm-content');
    if (!content) return;

    content.innerHTML = '';

    if (!session) {
      const startBtn = document.createElement('button');
      startBtn.className = 'crm-start-btn';
      startBtn.textContent = 'Start Review';
      startBtn.addEventListener('click', () => {
        this.onStartReview?.();
      });
      content.appendChild(startBtn);
    } else {
      const status = document.createElement('div');
      status.className = 'crm-status';
      status.textContent = 'Review in progress';
      content.appendChild(status);

      // Progress display
      const completedCount = session.completedSteps.length;
      const progress = document.createElement('div');
      progress.className = 'crm-progress';
      progress.textContent = `Progress: ${completedCount} / 5`;
      content.appendChild(progress);

      // Step list
      const stepsContainer = document.createElement('div');
      stepsContainer.className = 'crm-steps';

      for (const step of ALL_STEPS) {
        const isCompleted = session.completedSteps.includes(step);
        const isActive = this.currentStep === step;

        const stepItem = document.createElement('div');
        stepItem.className = 'crm-step-item';
        if (isCompleted) stepItem.classList.add('crm-step-completed');
        if (isActive) stepItem.classList.add('crm-step-active');

        // Completion indicator
        const indicator = document.createElement('span');
        indicator.className = 'crm-step-indicator';
        indicator.textContent = isCompleted ? '✓' : '○';

        // Step name
        const name = document.createElement('span');
        name.className = 'crm-step-name';
        name.textContent = STEP_LABELS[step];

        stepItem.appendChild(indicator);
        stepItem.appendChild(name);

        // Click to navigate
        stepItem.addEventListener('click', () => {
          this.currentStep = step;
          this.onStepClick?.(step);
        });

        // Complete button (only for active step)
        if (isActive && !isCompleted) {
          const completeBtn = document.createElement('button');
          completeBtn.className = 'crm-complete-btn';
          completeBtn.textContent = 'Complete';
          completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onCompleteStep?.(step);
          });
          stepItem.appendChild(completeBtn);
        }

        stepsContainer.appendChild(stepItem);
      }

      content.appendChild(stepsContainer);

      // Action panel
      const actionPanel = document.createElement('div');
      actionPanel.className = 'crm-action-panel';

      // Current move display
      const currentMoveDisplay = document.createElement('div');
      currentMoveDisplay.className = 'crm-current-move';
      currentMoveDisplay.textContent = _currentMove
        ? `Current Move: ${_currentMove.moveNumber}`
        : 'Current Move: —';
      actionPanel.appendChild(currentMoveDisplay);

      // Mark Critical button
      const markCriticalBtn = document.createElement('button');
      markCriticalBtn.className = 'crm-mark-critical-btn';
      markCriticalBtn.textContent = 'Mark Critical';
      markCriticalBtn.addEventListener('click', () => {
        this.onMarkCritical?.();
      });
      actionPanel.appendChild(markCriticalBtn);

      // Critical positions list
      const criticalList = document.createElement('div');
      criticalList.className = 'crm-critical-list';
      for (const cp of session.criticalPositions) {
        const item = document.createElement('div');
        item.className = 'crm-critical-item';
        item.textContent = `Move ${cp.moveNumber}`;
        criticalList.appendChild(item);
      }
      actionPanel.appendChild(criticalList);

      // Mistake type dropdown
      const mistakeDropdown = document.createElement('select');
      mistakeDropdown.className = 'crm-mistake-dropdown';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '— Select Mistake Type —';
      mistakeDropdown.appendChild(defaultOption);
      for (const type of ALL_MISTAKE_TYPES) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        mistakeDropdown.appendChild(option);
      }
      mistakeDropdown.addEventListener('change', () => {
        if (mistakeDropdown.value) {
          this.onTagMistake?.(mistakeDropdown.value as MistakeType);
        }
      });
      actionPanel.appendChild(mistakeDropdown);

      // Mistake tags list
      const mistakeList = document.createElement('div');
      mistakeList.className = 'crm-mistake-list';
      for (const mt of session.mistakeTags) {
        const item = document.createElement('div');
        item.className = 'crm-mistake-item';
        item.textContent = `Move ${mt.moveNumber}: ${mt.mistakeType}`;
        mistakeList.appendChild(item);
      }
      actionPanel.appendChild(mistakeList);

      // Notes section
      const addNoteBtn = document.createElement('button');
      addNoteBtn.className = 'crm-add-note-btn';
      addNoteBtn.textContent = 'Add Note';
      addNoteBtn.addEventListener('click', () => {
        // Show textarea and save button
        noteTextarea.style.display = 'block';
        saveNoteBtn.style.display = 'block';
        noteTextarea.focus();
      });
      actionPanel.appendChild(addNoteBtn);

      const noteTextarea = document.createElement('textarea');
      noteTextarea.className = 'crm-note-textarea';
      noteTextarea.style.display = 'none';
      actionPanel.appendChild(noteTextarea);

      const saveNoteBtn = document.createElement('button');
      saveNoteBtn.className = 'crm-save-note-btn';
      saveNoteBtn.textContent = 'Save';
      saveNoteBtn.style.display = 'none';
      saveNoteBtn.addEventListener('click', () => {
        const text = noteTextarea.value;
        if (text) {
          this.onAddNote?.(text);
          noteTextarea.value = '';
        }
      });
      actionPanel.appendChild(saveNoteBtn);

      // Notes list
      const notesList = document.createElement('div');
      notesList.className = 'crm-notes-list';
      for (const note of session.notes) {
        const item = document.createElement('div');
        item.className = 'crm-note-item';
        item.textContent = `Move ${note.moveNumber}: ${note.text}`;
        notesList.appendChild(item);
      }
      actionPanel.appendChild(notesList);

      // Summary section
      const summarySection = document.createElement('div');
      summarySection.className = 'crm-summary-section';

      const summaryHeading = document.createElement('h3');
      summaryHeading.className = 'crm-summary-heading';
      summaryHeading.textContent = 'Game Summary';
      summarySection.appendChild(summaryHeading);

      const summaryFields: { key: keyof GameSummary; label: string }[] = [
        { key: 'opening', label: 'Opening' },
        { key: 'middlegame', label: 'Middlegame' },
        { key: 'endgame', label: 'Endgame' },
        { key: 'biggestMistake', label: 'Biggest Mistake' },
        { key: 'lessonLearned', label: 'Lesson Learned' },
      ];

      const textareas: Record<string, HTMLTextAreaElement> = {};

      for (const field of summaryFields) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'crm-summary-field';

        const label = document.createElement('label');
        label.textContent = field.label;
        fieldDiv.appendChild(label);

        const textarea = document.createElement('textarea');
        textarea.className = 'crm-summary-textarea';
        textarea.setAttribute('data-field', field.key);
        if (session.summary) {
          textarea.value = session.summary[field.key];
        }
        fieldDiv.appendChild(textarea);

        textareas[field.key] = textarea;
        summarySection.appendChild(fieldDiv);
      }

      const saveSummaryBtn = document.createElement('button');
      saveSummaryBtn.className = 'crm-save-summary-btn';
      saveSummaryBtn.textContent = 'Save Summary';
      saveSummaryBtn.addEventListener('click', () => {
        const summary: GameSummary = {
          opening: textareas['opening'].value,
          middlegame: textareas['middlegame'].value,
          endgame: textareas['endgame'].value,
          biggestMistake: textareas['biggestMistake'].value,
          lessonLearned: textareas['lessonLearned'].value,
        };
        // Prevent submission when all fields are empty
        const allEmpty = Object.values(summary).every((v) => v.trim() === '');
        if (allEmpty) return;
        this.onSaveSummary?.(summary);
      });
      summarySection.appendChild(saveSummaryBtn);

      actionPanel.appendChild(summarySection);

      content.appendChild(actionPanel);
    }
  }

  showError(message: string): void {
    const content = this.container?.querySelector('.crm-content');
    if (!content) return;

    // Remove any existing error
    const existing = content.querySelector('.crm-error');
    if (existing) existing.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'crm-error';
    errorDiv.textContent = message;

    content.insertBefore(errorDiv, content.firstChild);
  }
}
