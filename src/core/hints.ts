export interface HintDef {
  level: number;
  text: string;
}

export class HintTracker {
  private used = 0;
  constructor(private readonly hints: readonly HintDef[]) {}

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
    return hint;
  }

  reset(): void {
    this.used = 0;
  }
}
