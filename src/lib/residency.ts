/** Logical sources are unlimited; only a small working set owns decoded pixels/textures. */
export function residentSlots(
  count: number,
  a: number,
  b: number,
  previous: number,
  quadrants: boolean,
) {
  if (count <= 8) return Array.from({ length: count }, (_, i) => i);
  const slots = new Set<number>();
  const add = (slot: number) => {
    if (slot >= 0 && slot < count && slots.size < 8) slots.add(slot);
  };
  [a, b, ...(quadrants ? [0, 1, 2, 3] : []), previous].forEach(add);
  for (let offset = 1; offset <= 8; offset++) {
    add((a + offset) % count);
    add((a - offset + count) % count);
  }
  return [...slots];
}
