import type { TWeeklySchedule } from "#utils/database/models/profile";

export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_TIME_ZONE = "Europe/Vienna";

export const validateWeeklySchedule = (value: unknown): value is TWeeklySchedule => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const schedule = value as Record<string, unknown>;

	return WEEK_DAYS.every((day) => {
		const dayValue = schedule[day];
		if (!dayValue || typeof dayValue !== "object" || Array.isArray(dayValue)) return false;
		const { closed, ranges } = dayValue as { closed?: unknown; ranges?: unknown };
		if (typeof closed !== "boolean" || !Array.isArray(ranges) || ranges.length > 2) return false;
		if (closed && ranges.length !== 0) return false;
		if (!closed && ranges.length === 0) return false;

		return ranges.every((range) => {
			if (!range || typeof range !== "object" || Array.isArray(range)) return false;
			const { from, to } = range as { from?: unknown; to?: unknown };
			return typeof from === "string" && typeof to === "string" && TIME_PATTERN.test(from) && TIME_PATTERN.test(to);
		});
	});
};

const toMinutes = (value: string) => {
	const [hours, minutes] = value.split(":").map(Number);
	return hours * 60 + minutes;
};

export const isScheduleOpenAt = (schedule: TWeeklySchedule | undefined, at = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
	if (!schedule || !validateWeeklySchedule(schedule)) return true;

	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		weekday: "long",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase();
	const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
	const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
	if (!weekday || !schedule[weekday]) return true;

	const day = schedule[weekday];
	if (day.closed) return false;
	const currentMinutes = hour * 60 + minute;

	return day.ranges.some((range) => {
		const from = toMinutes(range.from);
		const rawTo = toMinutes(range.to);
		const to = range.to === "00:00" ? 24 * 60 : rawTo;
		if (to >= from) return currentMinutes >= from && currentMinutes < to;
		return currentMinutes >= from || currentMinutes < rawTo;
	});
};
