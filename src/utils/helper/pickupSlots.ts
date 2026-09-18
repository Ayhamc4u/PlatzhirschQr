import type { TCategoryAvailability, TOrderPause, TWeeklySchedule } from "#utils/database/models/profile";
import { isScheduleOpenAt } from "#utils/helper/businessHours";

const TIME_ZONE = "Europe/Vienna";
const DEFAULT_PREPARATION_MINUTES = 20;
const DEFAULT_SLOT_MINUTES = 15;
const DEFAULT_ADVANCE_DAYS = 7;

export type TPickupSlotProfile = {
	orderPause?: TOrderPause;
	serviceHours?: TWeeklySchedule;
	categoryAvailability?: TCategoryAvailability;
	pickupPreparationMinutes?: number;
	pickupSlotMinutes?: number;
	pickupAdvanceDays?: number;
};

export type TPickupSlot = { at: string; label: string };
export type TPickupSlotDay = { date: string; label: string; slots: TPickupSlot[] };

const clampInteger = (value: number | undefined, fallback: number, min: number, max: number) => {
	if (!Number.isInteger(value)) return fallback;
	return Math.min(max, Math.max(min, value as number));
};

export const getPickupSettings = (profile: TPickupSlotProfile) => ({
	preparationMinutes: clampInteger(profile.pickupPreparationMinutes, DEFAULT_PREPARATION_MINUTES, 0, 240),
	slotMinutes: clampInteger(profile.pickupSlotMinutes, DEFAULT_SLOT_MINUTES, 5, 60),
	advanceDays: clampInteger(profile.pickupAdvanceDays, DEFAULT_ADVANCE_DAYS, 1, 30),
});

const dateParts = (at: Date) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
	return {
		date: `${read("year")}-${read("month")}-${read("day")}`,
		hour: Number(read("hour")),
		minute: Number(read("minute")),
	};
};

const dayLabel = (at: Date) => new Intl.DateTimeFormat("de-AT", {
	timeZone: TIME_ZONE,
	weekday: "short",
	day: "2-digit",
	month: "2-digit",
}).format(at);

const timeLabel = (at: Date) => new Intl.DateTimeFormat("de-AT", {
	timeZone: TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
}).format(at);

export const isCartScheduleOpenAt = (profile: TPickupSlotProfile, categories: string[], at: Date) => {
	if (!isScheduleOpenAt(profile.serviceHours, at, TIME_ZONE)) return false;
	const uniqueCategories = Array.from(new Set(categories.filter(Boolean)));
	return uniqueCategories.every((category) => {
		const categorySchedule = profile.categoryAvailability?.[category];
		return !categorySchedule || isScheduleOpenAt(categorySchedule, at, TIME_ZONE);
	});
};

export const isPickupTimeAvailable = (profile: TPickupSlotProfile, categories: string[], requestedAt: Date, now = new Date()) => {
	if (profile.orderPause?.all || profile.orderPause?.pickup) return false;
	if (!Number.isFinite(requestedAt.getTime())) return false;

	const { preparationMinutes, slotMinutes, advanceDays } = getPickupSettings(profile);
	const earliest = now.getTime() + preparationMinutes * 60_000;
	const latest = now.getTime() + advanceDays * 24 * 60 * 60_000;
	const requested = requestedAt.getTime();
	if (requested < earliest || requested > latest) return false;

	const local = dateParts(requestedAt);
	if (local.minute % slotMinutes !== 0 || requestedAt.getUTCSeconds() !== 0 || requestedAt.getUTCMilliseconds() !== 0) return false;
	return isCartScheduleOpenAt(profile, categories, requestedAt);
};

export const buildPickupSlots = (profile: TPickupSlotProfile, categories: string[], now = new Date()): TPickupSlotDay[] => {
	if (profile.orderPause?.all || profile.orderPause?.pickup) return [];

	const { preparationMinutes, slotMinutes, advanceDays } = getPickupSettings(profile);
	const slotMs = slotMinutes * 60_000;
	const earliest = now.getTime() + preparationMinutes * 60_000;
	let cursor = Math.ceil(earliest / slotMs) * slotMs;
	const latest = now.getTime() + advanceDays * 24 * 60 * 60_000;
	const grouped = new Map<string, TPickupSlotDay>();

	for (; cursor <= latest; cursor += slotMs) {
		const at = new Date(cursor);
		if (!isCartScheduleOpenAt(profile, categories, at)) continue;
		const local = dateParts(at);
		let day = grouped.get(local.date);
		if (!day) {
			day = { date: local.date, label: dayLabel(at), slots: [] };
			grouped.set(local.date, day);
		}
		day.slots.push({ at: at.toISOString(), label: timeLabel(at) });
	}

	return Array.from(grouped.values());
};
