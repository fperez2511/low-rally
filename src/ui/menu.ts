import { AUTHOR, VERSION } from '../config';

/** Intents the menu raises; main.ts binds them to the game (Command pattern). */
export interface MenuActions {
  onStart(): void;
  onResume(): void;
  /** Restart button pressed; the owner decides whether a confirmation is needed. */
  onRestart(): void;
  onRestartConfirmed(): void;
  onToggleSound(): void;
  onLeaderboard(): void;
}

type View = 'main' | 'confirm' | 'about';
type Mode = 'title' | 'paused';

/**
 * The modal menu (Facade over its main / restart-confirm / About views). It writes to the DOM
 * only in response to user actions or open/close calls, never from the game loop.
 */
export class MenuView {
  private readonly root = el('menu');
  private readonly heading = el('menu-heading');
  private readonly title = el('menu-title');
  private readonly views: Record<View, HTMLElement> = {
    main: el('menu-main'),
    confirm: el('menu-confirm'),
    about: el('menu-about'),
  };
  private readonly start = el('menu-start');
  private readonly resume = el('menu-resume');
  private readonly restart = el('menu-restart');
  private readonly sound = el('menu-sound');
  private readonly aboutBtn = el('menu-about-btn');
  private mode: Mode = 'title';
  private view: View = 'main';

  constructor(actions: MenuActions) {
    el('about-author').textContent = AUTHOR;
    el('about-version').textContent = VERSION;

    this.start.addEventListener('click', () => actions.onStart());
    this.resume.addEventListener('click', () => actions.onResume());
    this.restart.addEventListener('click', () => actions.onRestart());
    this.sound.addEventListener('click', () => actions.onToggleSound());
    el('menu-leaderboard').addEventListener('click', () => actions.onLeaderboard());
    this.aboutBtn.addEventListener('click', () => this.show('about'));
    el('menu-about-close').addEventListener('click', () => this.show('main'));
    el('menu-confirm-no').addEventListener('click', () => this.show('main'));
    el('menu-confirm-yes').addEventListener('click', () => actions.onRestartConfirmed());

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || e.defaultPrevented || this.root.hidden) return;
      e.preventDefault(); // consumed: main.ts must not treat the same press as "open the menu"
      if (this.view !== 'main') this.show('main');
      else if (this.mode === 'paused') actions.onResume();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  openTitle(): void {
    this.open('title');
  }

  openPaused(): void {
    this.open('paused');
  }

  /** Jump straight to the "Restart? Yes / No" view (used by the R key). */
  showConfirm(): void {
    this.show('confirm');
  }

  close(): void {
    this.root.hidden = true;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  setSound(on: boolean): void {
    this.sound.textContent = `Sound: ${on ? 'On' : 'Off'}`;
    this.sound.setAttribute('aria-pressed', String(on));
  }

  private open(mode: Mode): void {
    this.mode = mode;
    const title = mode === 'title';
    this.heading.hidden = !title;
    this.title.hidden = title;
    this.title.textContent = 'Paused';
    this.start.hidden = !title;
    this.resume.hidden = title;
    this.restart.hidden = title;
    this.root.hidden = false;
    this.show('main');
  }

  private show(view: View): void {
    this.view = view;
    (Object.keys(this.views) as View[]).forEach((v) => (this.views[v].hidden = v !== view));
    const focus =
      view === 'confirm' ? el('menu-confirm-no')
      : view === 'about' ? el('menu-about-close')
      : this.mode === 'title' ? this.start
      : this.resume;
    focus.focus();
  }
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
