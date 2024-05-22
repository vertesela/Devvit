export function getUTCTimestamp(
  date: string,
  time: string,
  timezone: string
): number {
  const longOffsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const longOffsetString = longOffsetFormatter.format(
    new Date(`${date}T${time}:00.000`)
  );

  const gmtOffset = longOffsetString.split('GMT')[1];
  const utc = new Date(`${date}T${time}:00.000` + gmtOffset);
  return utc.getTime();
}
