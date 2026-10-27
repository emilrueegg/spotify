function cells(id: string): { x: number; y: number; red: boolean }[] {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const drawn: { x: number; y: number; red: boolean }[] = [];
  const redIndex = hash % 16;
  const useRed = (hash >>> 11) % 5 === 0;
  for (let index = 0; index < 16; index += 1) {
    const on = ((hash >>> index) ^ (hash >>> ((index * 5) % 24))) & 1;
    if (!on) continue;
    drawn.push({
      x: index % 4,
      y: Math.floor(index / 4),
      red: useRed && index === redIndex,
    });
  }
  if (drawn.length === 0) drawn.push({ x: 0, y: 3, red: false });
  return drawn;
}

export function CoverMark({ id, imageUrl }: { id: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <span
        aria-hidden
        className="block size-9 shrink-0 bg-[#ececea] bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl.replace(/["\\()]/g, "")}")` }}
      />
    );
  }
  return (
    <svg viewBox="0 0 8 8" className="size-9 shrink-0 bg-[#ececea]" aria-hidden>
      {cells(id).map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x * 2}
          y={cell.y * 2}
          width="2"
          height="2"
          fill={cell.red ? "#EB0000" : "#121212"}
        />
      ))}
    </svg>
  );
}
