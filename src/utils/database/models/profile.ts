import mongoose, { type HydratedDocument } from "mongoose";
import type { TThemeColor } from "xtreme-ui";

import { Accounts, type TAccount } from "./account";

const accountCache = new Map<string, TAccount | null>();

export type TTimeRange = { from: string; to: string };
export type TDaySchedule = { closed: boolean; ranges: TTimeRange[] };
export type TWeeklySchedule = Record<string, TDaySchedule>;
export type TOrderPause = { all: boolean; pickup: boolean; dineIn: boolean };
export type TCategoryAvailability = Record<string, TWeeklySchedule>;

const ProfileSchema = new mongoose.Schema<TProfile>(
	{
		name: { type: String, trim: true, required: true },
		restaurantID: { type: String, trim: true, lowercase: true, unique: true, required: true, sparse: true, index: { unique: true } },
		description: { type: String, trim: true },
		address: { type: String, trim: true },
		themeColor: {
			h: { type: Number, trim: true, min: 0, max: 360 },
			s: { type: Number, trim: true, min: 0, max: 100 },
			l: { type: Number, trim: true, min: 0, max: 100 },
		},
		gstInclusive: { type: Boolean, default: false },
		categories: [{ type: String, trim: true, lowercase: true, match: /^[^,]*$/ }],
		avatar: { type: String, trim: true },
		cover: { type: String, trim: true },
		photos: [{ type: String, trim: true }],
		orderPause: {
			all: { type: Boolean, default: false },
			pickup: { type: Boolean, default: false },
			dineIn: { type: Boolean, default: false },
		},
		openingHours: { type: mongoose.Schema.Types.Mixed, default: {} },
		serviceHours: { type: mongoose.Schema.Types.Mixed, default: {} },
		categoryAvailability: { type: mongoose.Schema.Types.Mixed, default: {} },
		pickupPreparationMinutes: { type: Number, min: 0, max: 240, default: 20 },
		pickupSlotMinutes: { type: Number, min: 5, max: 60, default: 15 },
		pickupAdvanceDays: { type: Number, min: 1, max: 30, default: 7 },
	},
	{ timestamps: true },
);

ProfileSchema.pre("save", async function () {
	let account = accountCache.get(this.restaurantID);
	if (!account) {
		account = await Accounts.findOne<TAccount>({ username: this.restaurantID });
		if (account) accountCache.set(this.restaurantID, account);
		else throw new Error(`The associated account with username '${this.restaurantID}'does not exist.`);
	}

	this.categories = Array.from(new Set(this.categories));
});
ProfileSchema.post("save", async function () {
	await Accounts.updateOne({ username: this.restaurantID }, { $set: { profile: this._id } });
});

export const Profiles = mongoose.models?.profiles ?? mongoose.model<TProfile>("profiles", ProfileSchema);
export type TProfile = HydratedDocument<{
	name: string;
	restaurantID: string;
	description: string;
	address: string;
	avatar: string;
	cover: string;
	photos: Array<string>;
	themeColor: TThemeColor;
	gstInclusive: boolean;
	categories: Array<string>;
	orderPause?: TOrderPause;
	openingHours?: TWeeklySchedule;
	serviceHours?: TWeeklySchedule;
	categoryAvailability?: TCategoryAvailability;
	pickupPreparationMinutes?: number;
	pickupSlotMinutes?: number;
	pickupAdvanceDays?: number;
}>;
