export interface HintDef {
  level: number;
  text: string;
}

export class HintTracker {
  private used = 0;
  private mistakeStreak = 0;

  constructor(
    private readonly hints: readonly HintDef[],
    /** Wrong answers in a row on the current prompt before a hint is surfaced automatically. */
    private readonly autoRevealAfter = 2,
  ) {}

  get usedCount(): number {
    return this.used;
  }

  get hasMore(): boolean {
    return this.used < this.hints.length;
  }

  next(): HintDef | null {
    if (!this.hasMore) return null;
    const hint = this.hints[this.used];
    this.used += 1;
    this.mistakeStreak = 0;
    return hint;
  }

  /**
   * Call after a wrong answer. Nobody should get stuck without asking for help, so once the
   * player has missed `autoRevealAfter` times in a row we surface the next hint for them.
   */
  registerMistake(): HintDef | null {
    this.mistakeStreak += 1;
    if (this.mistakeStreak >= this.autoRevealAfter && this.hasMore) {
      return this.next();
    }
    return null;
  }

  registerSuccess(): void {
    this.mistakeStreak = 0;
  }

  reset(): void {
    this.used = 0;
    this.mistakeStreak = 0;
  }
}
