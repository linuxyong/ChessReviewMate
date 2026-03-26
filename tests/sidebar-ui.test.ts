// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SidebarUI } from '../src/sidebar-ui';
import type { ReviewSession, FlowStep, MistakeType, GameSummary } from '../src/types/index';

function makeSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    gameId: 'test-game',
    createdAt: 1700000000000,
    completedSteps: [],
    criticalPositions: [],
    mistakeTags: [],
    notes: [],
    summary: null,
    ...overrides,
  };
}

describe('SidebarUI', () => {
  let ui: SidebarUI;
  let parent: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    parent = document.createElement('div');
    document.body.appendChild(parent);
    ui = new SidebarUI();
  });

  describe('inject', () => {
    it('creates sidebar DOM structure inside parent', () => {
      ui.inject(parent);

      const sidebar = parent.querySelector('.crm-sidebar');
      expect(sidebar).not.toBeNull();
      expect(sidebar?.querySelector('.crm-header')).not.toBeNull();
      expect(sidebar?.querySelector('.crm-content')).not.toBeNull();
    });

    it('displays ChessReviewMate title', () => {
      ui.inject(parent);

      const title = parent.querySelector('.crm-title');
      expect(title?.textContent).toBe('ChessReviewMate');
    });

    it('displays a toggle button', () => {
      ui.inject(parent);

      const toggleBtn = parent.querySelector('.crm-toggle-btn');
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn?.textContent).toBe('◀');
    });

    it('shows Start Review button when no session', () => {
      ui.inject(parent);

      const startBtn = parent.querySelector('.crm-start-btn');
      expect(startBtn).not.toBeNull();
      expect(startBtn?.textContent).toBe('Start Review');
    });
  });

  describe('collapse / expand', () => {
    it('collapse adds crm-collapsed class', () => {
      ui.inject(parent);
      ui.collapse();

      const sidebar = parent.querySelector('.crm-sidebar');
      expect(sidebar?.classList.contains('crm-collapsed')).toBe(true);
    });

    it('expand removes crm-collapsed class', () => {
      ui.inject(parent);
      ui.collapse();
      ui.expand();

      const sidebar = parent.querySelector('.crm-sidebar');
      expect(sidebar?.classList.contains('crm-collapsed')).toBe(false);
    });

    it('isCollapsed returns correct state', () => {
      ui.inject(parent);

      expect(ui.isCollapsed()).toBe(false);
      ui.collapse();
      expect(ui.isCollapsed()).toBe(true);
      ui.expand();
      expect(ui.isCollapsed()).toBe(false);
    });

    it('toggle button changes icon on collapse/expand', () => {
      ui.inject(parent);
      const toggleBtn = parent.querySelector('.crm-toggle-btn');

      expect(toggleBtn?.textContent).toBe('◀');
      ui.collapse();
      expect(toggleBtn?.textContent).toBe('▶');
      ui.expand();
      expect(toggleBtn?.textContent).toBe('◀');
    });

    it('clicking toggle button collapses then expands', () => {
      ui.inject(parent);
      const toggleBtn = parent.querySelector('.crm-toggle-btn') as HTMLElement;

      toggleBtn.click();
      expect(ui.isCollapsed()).toBe(true);

      toggleBtn.click();
      expect(ui.isCollapsed()).toBe(false);
    });

    it('clicking toggle button fires onToggle callback', () => {
      const toggleSpy = vi.fn();
      ui.onToggle = toggleSpy;
      ui.inject(parent);

      const toggleBtn = parent.querySelector('.crm-toggle-btn') as HTMLElement;
      toggleBtn.click();

      expect(toggleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('render', () => {
    it('shows Start Review button when session is null', () => {
      ui.inject(parent);
      ui.render(null, null);

      const startBtn = parent.querySelector('.crm-start-btn');
      expect(startBtn).not.toBeNull();
      expect(startBtn?.textContent).toBe('Start Review');
    });

    it('shows review in progress when session exists', () => {
      ui.inject(parent);
      const session = makeSession();
      ui.render(session, null);

      const status = parent.querySelector('.crm-status');
      expect(status?.textContent).toBe('Review in progress');
      expect(parent.querySelector('.crm-start-btn')).toBeNull();
    });

    it('Start Review button fires onStartReview callback', () => {
      const startSpy = vi.fn();
      ui.onStartReview = startSpy;
      ui.inject(parent);
      ui.render(null, null);

      const startBtn = parent.querySelector('.crm-start-btn') as HTMLElement;
      startBtn.click();

      expect(startSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('review flow steps', () => {
    it('renders five steps when session exists', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const steps = parent.querySelectorAll('.crm-step-item');
      expect(steps.length).toBe(5);

      const names = Array.from(parent.querySelectorAll('.crm-step-name')).map(
        (el) => el.textContent,
      );
      expect(names).toEqual([
        'Opening',
        'Critical Position',
        'Mistake Tagging',
        'Notes',
        'Summary',
      ]);
    });

    it('shows steps inside a .crm-steps container', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const container = parent.querySelector('.crm-steps');
      expect(container).not.toBeNull();
      expect(container?.querySelectorAll('.crm-step-item').length).toBe(5);
    });

    it('displays correct progress count with no completed steps', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const progress = parent.querySelector('.crm-progress');
      expect(progress?.textContent).toBe('Progress: 0 / 5');
    });

    it('displays correct progress count with some completed steps', () => {
      ui.inject(parent);
      ui.render(
        makeSession({ completedSteps: ['opening', 'notes', 'summary'] }),
        null,
      );

      const progress = parent.querySelector('.crm-progress');
      expect(progress?.textContent).toBe('Progress: 3 / 5');
    });

    it('completed steps show checkmark indicator', () => {
      ui.inject(parent);
      ui.render(
        makeSession({ completedSteps: ['opening', 'critical-position'] }),
        null,
      );

      const indicators = Array.from(
        parent.querySelectorAll('.crm-step-indicator'),
      ).map((el) => el.textContent);
      expect(indicators).toEqual(['✓', '✓', '○', '○', '○']);
    });

    it('completed steps have crm-step-completed class', () => {
      ui.inject(parent);
      ui.render(makeSession({ completedSteps: ['opening'] }), null);

      const steps = parent.querySelectorAll('.crm-step-item');
      expect(steps[0].classList.contains('crm-step-completed')).toBe(true);
      expect(steps[1].classList.contains('crm-step-completed')).toBe(false);
    });

    it('clicking a step fires onStepClick callback', () => {
      const stepSpy = vi.fn();
      ui.onStepClick = stepSpy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const steps = parent.querySelectorAll('.crm-step-item');
      (steps[2] as HTMLElement).click();

      expect(stepSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy).toHaveBeenCalledWith('mistake-tagging');
    });

    it('clicking a step sets currentStep', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const steps = parent.querySelectorAll('.crm-step-item');
      (steps[1] as HTMLElement).click();

      expect(ui.currentStep).toBe('critical-position');
    });

    it('active step has crm-step-active class', () => {
      ui.inject(parent);
      ui.currentStep = 'notes';
      ui.render(makeSession(), null);

      const steps = parent.querySelectorAll('.crm-step-item');
      expect(steps[3].classList.contains('crm-step-active')).toBe(true);
      expect(steps[0].classList.contains('crm-step-active')).toBe(false);
    });

    it('active non-completed step shows Complete button', () => {
      ui.inject(parent);
      ui.currentStep = 'opening';
      ui.render(makeSession(), null);

      const completeBtn = parent.querySelector('.crm-complete-btn');
      expect(completeBtn).not.toBeNull();
      expect(completeBtn?.textContent).toBe('Complete');
    });

    it('active completed step does not show Complete button', () => {
      ui.inject(parent);
      ui.currentStep = 'opening';
      ui.render(makeSession({ completedSteps: ['opening'] }), null);

      const completeBtn = parent.querySelector('.crm-complete-btn');
      expect(completeBtn).toBeNull();
    });

    it('Complete button fires onCompleteStep callback', () => {
      const completeSpy = vi.fn();
      ui.onCompleteStep = completeSpy;
      ui.inject(parent);
      ui.currentStep = 'opening';
      ui.render(makeSession(), null);

      const completeBtn = parent.querySelector(
        '.crm-complete-btn',
      ) as HTMLElement;
      completeBtn.click();

      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledWith('opening');
    });

    it('Complete button click does not trigger onStepClick', () => {
      const stepSpy = vi.fn();
      const completeSpy = vi.fn();
      ui.onStepClick = stepSpy;
      ui.onCompleteStep = completeSpy;
      ui.inject(parent);
      ui.currentStep = 'opening';
      ui.render(makeSession(), null);

      const completeBtn = parent.querySelector(
        '.crm-complete-btn',
      ) as HTMLElement;
      completeBtn.click();

      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(stepSpy).not.toHaveBeenCalled();
    });
  });

  describe('showError', () => {
    it('displays error message in content area', () => {
      ui.inject(parent);
      ui.showError('Something went wrong');

      const error = parent.querySelector('.crm-error');
      expect(error).not.toBeNull();
      expect(error?.textContent).toBe('Something went wrong');
    });

    it('replaces existing error message', () => {
      ui.inject(parent);
      ui.showError('First error');
      ui.showError('Second error');

      const errors = parent.querySelectorAll('.crm-error');
      expect(errors.length).toBe(1);
      expect(errors[0].textContent).toBe('Second error');
    });

    it('error appears before other content', () => {
      ui.inject(parent);
      ui.showError('Error message');

      const content = parent.querySelector('.crm-content');
      expect(content?.firstElementChild?.classList.contains('crm-error')).toBe(
        true,
      );
    });
  });

  describe('current move display', () => {
    it('shows "Current Move: —" when no move is selected', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const moveDisplay = parent.querySelector('.crm-current-move');
      expect(moveDisplay).not.toBeNull();
      expect(moveDisplay?.textContent).toBe('Current Move: —');
    });

    it('shows move number when a move is selected', () => {
      ui.inject(parent);
      ui.render(makeSession(), { moveNumber: 12, fen: 'some-fen' });

      const moveDisplay = parent.querySelector('.crm-current-move');
      expect(moveDisplay?.textContent).toBe('Current Move: 12');
    });

    it('does not show current move display when no session', () => {
      ui.inject(parent);
      ui.render(null, null);

      const moveDisplay = parent.querySelector('.crm-current-move');
      expect(moveDisplay).toBeNull();
    });
  });

  describe('mark critical button and list', () => {
    it('renders Mark Critical button when session is active', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const btn = parent.querySelector('.crm-mark-critical-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toBe('Mark Critical');
    });

    it('clicking Mark Critical fires onMarkCritical callback', () => {
      const spy = vi.fn();
      ui.onMarkCritical = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const btn = parent.querySelector('.crm-mark-critical-btn') as HTMLElement;
      btn.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('renders critical positions list', () => {
      ui.inject(parent);
      ui.render(
        makeSession({
          criticalPositions: [
            { gameId: 'g1', moveNumber: 5, fen: 'fen1', timestamp: 100 },
            { gameId: 'g1', moveNumber: 14, fen: 'fen2', timestamp: 200 },
          ],
        }),
        null,
      );

      const items = parent.querySelectorAll('.crm-critical-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Move 5');
      expect(items[1].textContent).toBe('Move 14');
    });

    it('renders empty critical list when no critical positions', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const list = parent.querySelector('.crm-critical-list');
      expect(list).not.toBeNull();
      expect(list?.querySelectorAll('.crm-critical-item').length).toBe(0);
    });
  });

  describe('mistake dropdown and list', () => {
    it('renders mistake type dropdown with default option and 9 types', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const dropdown = parent.querySelector('.crm-mistake-dropdown') as HTMLSelectElement;
      expect(dropdown).not.toBeNull();
      const options = dropdown.querySelectorAll('option');
      expect(options.length).toBe(10); // 1 default + 9 types
      expect(options[0].textContent).toBe('— Select Mistake Type —');
      expect(options[0].value).toBe('');
    });

    it('selecting a mistake type fires onTagMistake callback', () => {
      const spy = vi.fn();
      ui.onTagMistake = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const dropdown = parent.querySelector('.crm-mistake-dropdown') as HTMLSelectElement;
      dropdown.value = 'Blunder';
      dropdown.dispatchEvent(new Event('change'));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('Blunder');
    });

    it('selecting default option does not fire onTagMistake', () => {
      const spy = vi.fn();
      ui.onTagMistake = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const dropdown = parent.querySelector('.crm-mistake-dropdown') as HTMLSelectElement;
      dropdown.value = '';
      dropdown.dispatchEvent(new Event('change'));

      expect(spy).not.toHaveBeenCalled();
    });

    it('renders mistake tags list', () => {
      ui.inject(parent);
      ui.render(
        makeSession({
          mistakeTags: [
            { moveNumber: 8, fen: 'fen1', mistakeType: 'Blunder' },
            { moveNumber: 22, fen: 'fen2', mistakeType: 'Time Trouble' },
          ],
        }),
        null,
      );

      const items = parent.querySelectorAll('.crm-mistake-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Move 8: Blunder');
      expect(items[1].textContent).toBe('Move 22: Time Trouble');
    });
  });

  describe('note input and list', () => {
    it('renders Add Note button', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const btn = parent.querySelector('.crm-add-note-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toBe('Add Note');
    });

    it('textarea and save button are hidden initially', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const textarea = parent.querySelector('.crm-note-textarea') as HTMLElement;
      const saveBtn = parent.querySelector('.crm-save-note-btn') as HTMLElement;
      expect(textarea.style.display).toBe('none');
      expect(saveBtn.style.display).toBe('none');
    });

    it('clicking Add Note shows textarea and save button', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const addBtn = parent.querySelector('.crm-add-note-btn') as HTMLElement;
      addBtn.click();

      const textarea = parent.querySelector('.crm-note-textarea') as HTMLElement;
      const saveBtn = parent.querySelector('.crm-save-note-btn') as HTMLElement;
      expect(textarea.style.display).toBe('block');
      expect(saveBtn.style.display).toBe('block');
    });

    it('clicking Save fires onAddNote with textarea value and clears it', () => {
      const spy = vi.fn();
      ui.onAddNote = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      // Show the textarea
      (parent.querySelector('.crm-add-note-btn') as HTMLElement).click();

      const textarea = parent.querySelector('.crm-note-textarea') as HTMLTextAreaElement;
      textarea.value = 'My analysis note';

      const saveBtn = parent.querySelector('.crm-save-note-btn') as HTMLElement;
      saveBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('My analysis note');
      expect(textarea.value).toBe('');
    });

    it('clicking Save with empty textarea does not fire onAddNote', () => {
      const spy = vi.fn();
      ui.onAddNote = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      (parent.querySelector('.crm-add-note-btn') as HTMLElement).click();

      const saveBtn = parent.querySelector('.crm-save-note-btn') as HTMLElement;
      saveBtn.click();

      expect(spy).not.toHaveBeenCalled();
    });

    it('renders notes list', () => {
      ui.inject(parent);
      ui.render(
        makeSession({
          notes: [
            { moveNumber: 3, fen: 'fen1', text: 'Good opening choice' },
            { moveNumber: 17, fen: 'fen2', text: 'Should have played Nf3' },
          ],
        }),
        null,
      );

      const items = parent.querySelectorAll('.crm-note-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Move 3: Good opening choice');
      expect(items[1].textContent).toBe('Move 17: Should have played Nf3');
    });
  });

  describe('summary form', () => {
    it('renders summary section with five fields', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const section = parent.querySelector('.crm-summary-section');
      expect(section).not.toBeNull();

      const heading = section?.querySelector('.crm-summary-heading');
      expect(heading?.textContent).toBe('Game Summary');

      const fields = section?.querySelectorAll('.crm-summary-field');
      expect(fields?.length).toBe(5);

      const labels = Array.from(fields!).map(
        (f) => f.querySelector('label')?.textContent,
      );
      expect(labels).toEqual([
        'Opening',
        'Middlegame',
        'Endgame',
        'Biggest Mistake',
        'Lesson Learned',
      ]);

      const textareas = section?.querySelectorAll('.crm-summary-textarea');
      expect(textareas?.length).toBe(5);
    });

    it('pre-fills fields when session has a summary', () => {
      ui.inject(parent);
      const summary: GameSummary = {
        opening: 'Sicilian Defense',
        middlegame: 'Kingside attack',
        endgame: 'Rook endgame',
        biggestMistake: 'Missed Nxf7',
        lessonLearned: 'Calculate more',
      };
      ui.render(makeSession({ summary }), null);

      const textareas = parent.querySelectorAll('.crm-summary-textarea') as NodeListOf<HTMLTextAreaElement>;
      expect(textareas[0].value).toBe('Sicilian Defense');
      expect(textareas[1].value).toBe('Kingside attack');
      expect(textareas[2].value).toBe('Rook endgame');
      expect(textareas[3].value).toBe('Missed Nxf7');
      expect(textareas[4].value).toBe('Calculate more');
    });

    it('Save Summary fires onSaveSummary with correct values', () => {
      const spy = vi.fn();
      ui.onSaveSummary = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const textareas = parent.querySelectorAll('.crm-summary-textarea') as NodeListOf<HTMLTextAreaElement>;
      textareas[0].value = 'French Defense';
      textareas[1].value = 'Pawn structure';
      textareas[2].value = 'Bishop vs Knight';
      textareas[3].value = 'Blundered a pawn';
      textareas[4].value = 'Watch for tactics';

      const saveBtn = parent.querySelector('.crm-save-summary-btn') as HTMLElement;
      saveBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        opening: 'French Defense',
        middlegame: 'Pawn structure',
        endgame: 'Bishop vs Knight',
        biggestMistake: 'Blundered a pawn',
        lessonLearned: 'Watch for tactics',
      });
    });

    it('empty form submission is prevented', () => {
      const spy = vi.fn();
      ui.onSaveSummary = spy;
      ui.inject(parent);
      ui.render(makeSession(), null);

      const saveBtn = parent.querySelector('.crm-save-summary-btn') as HTMLElement;
      saveBtn.click();

      expect(spy).not.toHaveBeenCalled();
    });

    it('has a Save Summary button', () => {
      ui.inject(parent);
      ui.render(makeSession(), null);

      const btn = parent.querySelector('.crm-save-summary-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toBe('Save Summary');
    });

    it('fields remain editable after pre-fill', () => {
      ui.inject(parent);
      const summary: GameSummary = {
        opening: 'Sicilian',
        middlegame: 'Attack',
        endgame: 'Draw',
        biggestMistake: 'Blunder',
        lessonLearned: 'Focus',
      };
      ui.render(makeSession({ summary }), null);

      const textareas = parent.querySelectorAll('.crm-summary-textarea') as NodeListOf<HTMLTextAreaElement>;
      // Verify fields are not disabled/readonly
      for (const ta of textareas) {
        expect(ta.disabled).toBe(false);
        expect(ta.readOnly).toBe(false);
      }
    });
  });
});
