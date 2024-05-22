import Timezones from '../data/timezones.json';
const ids = Timezones.map((timezone) => timezone.id);
export type TimezoneId = (typeof ids)[number];
