/** Guards concurrent full-data sync: only the latest run may apply results. */
export function createSyncGenerationGuard() {
  let generation = 0;

  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    isCurrent(runGeneration: number): boolean {
      return runGeneration === generation;
    },
    shouldFinalize(runGeneration: number): boolean {
      return runGeneration === generation;
    },
  };
}
