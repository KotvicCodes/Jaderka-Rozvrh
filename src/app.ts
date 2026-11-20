import { DEFAULT_COLOR_ID, FIRST_HOUR, KNOWN_SPECS } from './config';
import { openLessonDialog } from './dialog';
import { h } from './dom';
import { renderGrid } from './grid';
import { createSchedule, type Lesson, type LessonDraft, type Schedule } from './model';
import { loadState, saveState, type AppState } from './storage';

export class App {
  private state: AppState;
  private readonly root: HTMLElement;
  private readonly boardHost = h('section', { class: 'board-host' });
  private readonly toolbar = h('div', { class: 'toolbar' });
  private readonly status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = loadState();
    this.root.replaceChildren(
      h('header', { class: 'topbar' }, h('strong', {}, 'Jaderka Rozvrh'), h('span', { class: 'topbar-sub' }, 'vlastní rozvrh pro FJFI')),
      h(
        'main',
        { class: 'container' },
        this.toolbar,
        h('p', { class: 'hint' }, 'Klikni na volné políčko pro přidání hodiny, na existující hodinu pro úpravu. Hodiny začínají vždy v celou.'),
        this.boardHost,
        this.status,
      ),
    );
    this.render();
  }

  private get active(): Schedule {
    return this.state.schedules.find((s) => s.id === this.state.activeId) ?? this.state.schedules[0]!;
  }

  private commit(message?: string): void {
    this.active.updatedAt = Date.now();
    const ok = saveState(this.state);
    this.status.textContent = ok ? (message ?? '') : 'Rozvrh se nepodařilo uložit v prohlížeči (soukromé okno?).';
    this.render();
  }

  private scheduleLabel(schedule: Schedule, index: number): string {
    return schedule.specId || `Rozvrh ${index + 1}`;
  }

  private renderToolbar(): void {
    const active = this.active;

    const picker = h(
      'select',
      { 'aria-label': 'Vybrat rozvrh' },
      ...this.state.schedules.map((s, i) => h('option', { value: s.id, selected: s.id === active.id }, this.scheduleLabel(s, i))),
    );
    picker.addEventListener('change', () => {
      this.state.activeId = picker.value;
      saveState(this.state);
      this.render();
    });

    const specInput = h('input', {
      list: 'spec-ids',
      value: active.specId,
      maxlength: 80,
      placeholder: 'např. Bc1JCF1',
      autocomplete: 'off',
      spellcheck: false,
    });
    const specName = h('span', { class: 'spec-name' }, KNOWN_SPECS.find((s) => s.id === active.specId)?.name ?? '');
    specInput.addEventListener('change', () => {
      active.specId = specInput.value.trim().slice(0, 80);
      this.commit('ID zaměření uloženo.');
    });

    const newBtn = h('button', { type: 'button', class: 'btn' }, 'Nový rozvrh');
    newBtn.addEventListener('click', () => {
      const schedule = createSchedule();
      this.state.schedules.push(schedule);
      this.state.activeId = schedule.id;
      this.commit('Vytvořen nový rozvrh.');
    });

    const deleteBtn = h('button', { type: 'button', class: 'btn btn-danger' }, 'Smazat rozvrh');
    deleteBtn.addEventListener('click', () => {
      const label = this.scheduleLabel(active, this.state.schedules.indexOf(active));
      if (!confirm(`Opravdu smazat rozvrh „${label}“?`)) return;
      this.state.schedules = this.state.schedules.filter((s) => s.id !== active.id);
      if (this.state.schedules.length === 0) this.state.schedules.push(createSchedule());
      this.state.activeId = this.state.schedules[0]!.id;
      this.commit('Rozvrh smazán.');
    });

    const addBtn = h('button', { type: 'button', class: 'btn btn-primary' }, '+ Přidat hodinu');
    addBtn.addEventListener('click', () => void this.addLesson(0, FIRST_HOUR));

    this.toolbar.replaceChildren(
      h('label', { class: 'toolbar-field' }, h('span', {}, 'Rozvrh'), picker),
      h('label', { class: 'toolbar-field' }, h('span', {}, 'ID zaměření'), specInput),
      specName,
      h('datalist', { id: 'spec-ids' }, ...KNOWN_SPECS.map((s) => h('option', { value: s.id }, s.name))),
      h('span', { class: 'spacer' }),
      newBtn,
      deleteBtn,
      addBtn,
    );
  }

  private render(): void {
    this.renderToolbar();
    this.boardHost.replaceChildren(
      renderGrid(this.active, {
        onSlotClick: (day, hour) => void this.addLesson(day, hour),
        onLessonClick: (lesson) => void this.editLesson(lesson),
      }),
    );
  }

  private async addLesson(day: number, hour: number): Promise<void> {
    const draft: LessonDraft = { day, start: hour, duration: 2, subject: '', room: '', lecturer: '', color: DEFAULT_COLOR_ID };
    const result = await openLessonDialog(draft);
    if (result.action === 'save') {
      this.active.lessons.push(result.lesson);
      this.commit(`Přidáno: ${result.lesson.subject}`);
    }
  }

  private async editLesson(lesson: Lesson): Promise<void> {
    const result = await openLessonDialog(lesson, lesson);
    const lessons = this.active.lessons;
    if (result.action === 'save') {
      this.active.lessons = lessons.map((l) => (l.id === result.lesson.id ? result.lesson : l));
      this.commit(`Upraveno: ${result.lesson.subject}`);
    } else if (result.action === 'delete') {
      this.active.lessons = lessons.filter((l) => l.id !== result.id);
      this.commit('Hodina smazána.');
    }
  }
}
