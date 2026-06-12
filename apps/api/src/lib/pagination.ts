export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id })
  ).toString("base64url");
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const { createdAt, id } = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8")
  );
  return { createdAt: new Date(createdAt as string), id: id as string };
}
