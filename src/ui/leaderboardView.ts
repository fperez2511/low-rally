import type { Leaderboard } from '../leaderboard/leaderboard';
import { formatTime } from './hud';

/**
 * Modal leaderboard panel. It touches the DOM only when opened or cleared, never from the
 * game loop, so it costs nothing while driving.
 */
export class LeaderboardView {
  private readonly root = document.getElementById('leaderboard')!;
  private readonly list = document.getElementById('lb-list')!;
  private readonly empty = document.getElementById('lb-empty')!;
  private readonly clearBtn = document.getElementById('lb-clear') as HTMLButtonElement;
  private highlight: number | null = null;
  private opener: HTMLElement | null = null;

  constructor(private readonly board: Leaderboard) {
    document.getElementById('lb-close')!.addEventListener('click', () => this.close());
    this.clearBtn.addEventListener('click', () => {
      if (window.confirm('Clear all saved times?')) {
        this.board.clear();
        this.highlight = null;
        this.render();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Shows the board; `highlightRank` marks the player's just-finished run, if it placed. */
  open(highlightRank: number | null): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.highlight = highlightRank;
    this.render();
    this.root.hidden = false;
    document.getElementById('lb-close')!.focus();
  }

  close(): void {
    this.root.hidden = true;
    this.opener?.blur(); // don't leave focus on a button that Space/Enter could re-trigger
    this.opener = null;
  }

  private render(): void {
    const entries = this.board.entries();
    this.empty.hidden = entries.length > 0;
    this.clearBtn.hidden = entries.length === 0;
    this.list.replaceChildren(
      ...entries.map((e, i) => {
        const li = document.createElement('li');
        const rank = document.createElement('span');
        rank.textContent = String(i + 1);
        const time = document.createElement('span');
        time.className = 'lb-time';
        time.textContent = formatTime(e.time);
        if (this.highlight === i + 1) {
          li.className = 'lb-new';
          const tag = document.createElement('span');
          tag.className = 'lb-tag';
          tag.textContent = `Your run: #${i + 1}`;
          time.append(tag);
        }
        const date = document.createElement('span');
        date.className = 'lb-date';
        date.textContent = e.date === null ? '—' : new Date(e.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        li.append(rank, time, date);
        return li;
      }),
    );
  }
}
