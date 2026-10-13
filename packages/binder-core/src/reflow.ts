export interface PocketState<T> {
  code: string;
  locked?: boolean;
  coveredByPanel?: boolean;
  content: T;
}

export type ReflowOp<T> =
  | { type: "insert"; at: string; content: T }
  | { type: "remove"; at: string; emptyContent: T };

function isMovable<T>(pocket: PocketState<T>): boolean {
  return !pocket.locked && !pocket.coveredByPanel;
}

// Locked pockets and panel-covered pockets are fixed in place; content shifts
// only between the movable slots, jumping over any fixed one.
export function reflow<T>(pockets: PocketState<T>[], op: ReflowOp<T>): PocketState<T>[] {
  const result = pockets.map((p) => ({ ...p }));
  const atPosition = result.findIndex((p) => p.code === op.at);
  if (atPosition === -1) {
    return result;
  }

  const movableIndexes: number[] = [];
  for (let i = atPosition; i < result.length; i++) {
    if (isMovable(result[i] as PocketState<T>)) {
      movableIndexes.push(i);
    }
  }

  if (movableIndexes.length === 0) {
    return result;
  }

  if (op.type === "insert") {
    for (let k = movableIndexes.length - 1; k > 0; k--) {
      const target = result[movableIndexes[k] as number] as PocketState<T>;
      const source = result[movableIndexes[k - 1] as number] as PocketState<T>;
      target.content = source.content;
    }
    (result[movableIndexes[0] as number] as PocketState<T>).content = op.content;
  } else {
    for (let k = 0; k < movableIndexes.length - 1; k++) {
      const target = result[movableIndexes[k] as number] as PocketState<T>;
      const source = result[movableIndexes[k + 1] as number] as PocketState<T>;
      target.content = source.content;
    }
    const lastMovable = result[
      movableIndexes[movableIndexes.length - 1] as number
    ] as PocketState<T>;
    lastMovable.content = op.emptyContent;
  }

  return result;
}
