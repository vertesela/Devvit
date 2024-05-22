// A collection of functions to generate keys for Redis

export function getTournamentsKey(): string {
  return 'tournaments';
}

export function getTournamentKey(tournamentId: string): string {
  return `tournament:${tournamentId}`;
}

export function questionField(postId: string, key: string): string {
  return `question:${postId}:${key}`;
}

export function getIntroSeenKey(tournamentId: string): string {
  return `introseen:${tournamentId}`;
}

export function getIntroSeenField(userId: string): string {
  return userId;
}

export function getScoreboardKey(tournamentId: string): string {
  return `scoreboard:${tournamentId}`;
}

export function getScoreboardField(userId: string): string {
  return userId;
}

export function getPostKey(postId: string): string {
  return `post:${postId}`;
}

export function getOptionFieldKey(
  optionId: string | number,
  field: string
): string {
  return `option:${optionId}:${field}`;
}

export function getPostEventsKey(postId: string): string {
  return `post:${postId}:events`;
}

export function getUserEventsKey(
  tournamentId: string,
  userId: string | undefined
): string {
  return `user-events:${userId}:${tournamentId}`;
}

export function getEventField(type: string, key?: string): string {
  return `${type}:${key}`;
}

export function getDraftsKey(): string {
  return 'draft-posts';
}

export function getDraftField(userId: string): string {
  return `draft:${userId}`;
}
