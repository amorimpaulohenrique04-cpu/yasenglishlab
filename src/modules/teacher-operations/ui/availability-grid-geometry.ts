interface Interval {
  startMin: number;
  endMin: number;
}

/** Keep every uncovered vertical fragment large enough for a 24px target plus rounding. */
export function availabilityHourHeight(days: Interval[][], from: number, to: number) {
  let shortest = 60;
  for (const blocks of days) {
    const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
    for (let hour = from; hour < to; hour++) {
      let cursor = hour * 60;
      const end = cursor + 60;
      for (const block of sorted) {
        if (block.endMin <= cursor || block.startMin >= end) continue;
        if (block.startMin > cursor) shortest = Math.min(shortest, block.startMin - cursor);
        cursor = Math.max(cursor, Math.min(end, block.endMin));
      }
      if (cursor < end) shortest = Math.min(shortest, end - cursor);
    }
  }
  return Math.max(80, Math.ceil((26 * 60) / shortest));
}
