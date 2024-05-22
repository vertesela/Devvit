export function formatTimeLeft(duration: number): string {
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    return `${years}y left`;
  } else if (months >= 1) {
    return `${months}mo left`;
  } else if (weeks >= 1) {
    return `${weeks}w left`;
  } else if (days >= 1) {
    return `${days}d left`;
  } else if (hours >= 1) {
    return `${hours}h left`;
  } else if (minutes >= 1) {
    return `${minutes}m left`;
  } else if (seconds >= 1) {
    return `${seconds}s left`;
  } else {
    return 'Ended';
  }
}
