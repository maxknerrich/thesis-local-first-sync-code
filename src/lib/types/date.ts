export const validateISO861Date = (date: TDateISO): boolean => {
	// Check if the date is in ISO 8601 format
	const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
	return iso8601Regex.test(date);
};

type TYear = `${number}${number}${number}${number}`;
type TMonth = `${number}${number}`;
type TDay = `${number}${number}`;
type THours = `${number}${number}`;
type TMinutes = `${number}${number}`;
type TSeconds = `${number}${number}`;
type TMilliseconds = `${number}${number}${number}`;
export type TDateISODate = `${TYear}-${TMonth}-${TDay}`;
export type TDateISOTime = `${THours}:${TMinutes}:${TSeconds}.${TMilliseconds}`;
export type TDateISO = `${TDateISODate}T${TDateISOTime}Z`;
