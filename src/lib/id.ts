let counter = 0;

/**
 * Local-only identifiers.
 *
 * Not globally unique across devices — good enough for data that lives on one
 * device with no backend yet. When sync is built, the server assigns the
 * durable id for anything it accepts and this one is replaced.
 */
export function generateLocalId(prefix: string): string {
  counter += 1;

  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
