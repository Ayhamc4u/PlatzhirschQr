import mongoose from "mongoose";

import { Accounts, type TAccount } from "./account";

const accountCache = new Map<string, TAccount | null>();

const TableSchema = new mongoose.Schema<TTable>(
	{
		name: {
			type: String,
			trim: true,
			required: true,
		},

		username: {
			type: String,
			trim: true,
			required: true,
		},

		restaurantID: {
			type: String,
			trim: true,
			lowercase: true,
			required: true,
		},

		ready2orderTableId: {
			type: Number,
		},

		ready2orderTableAreaId: {
			type: Number,
		},

		ready2orderOrder: {
			type: Number,
			default: 0,
		},

		ready2orderCheckoutMode: {
			type: Boolean,
			default: false,
		},

		ready2orderIsTemporary: {
			type: Boolean,
			default: false,
		},

		description: {
			type: String,
			trim: true,
		},

		ready2orderUpdatedAt: {
			type: Date,
		},

		qrToken: {
			type: String,
			trim: true,
		},

		qrUrl: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true,
	},
);

/*
 * Bestehender interner Tisch-Identifier.
 * Innerhalb eines Restaurants muss username eindeutig sein.
 */
TableSchema.index(
	{ username: 1, restaurantID: 1 },
	{ unique: true },
);

/*
 * Ein ready2order-Tisch darf pro Restaurant nur einmal existieren.
 */
TableSchema.index(
	{ restaurantID: 1, ready2orderTableId: 1 },
	{ unique: true, sparse: true },
);

/*
 * Der QR-Token bleibt dauerhaft einem Tisch zugeordnet
 * und darf pro Restaurant nicht doppelt vorkommen.
 */
TableSchema.index(
	{ restaurantID: 1, qrToken: 1 },
	{ unique: true, sparse: true },
);

TableSchema.pre("save", async function () {
	let account = accountCache.get(this.restaurantID);

	if (!account) {
		account = await Accounts.findOne<TAccount>({
			username: this.restaurantID,
		});

		if (!account) {
			throw new Error(
				`The associated account with username '${this.restaurantID}' does not exist.`,
			);
		}

		accountCache.set(this.restaurantID, account);
	}
});

TableSchema.post("save", async function () {
	await Accounts.updateOne(
		{ username: this.restaurantID },
		{ $addToSet: { tables: this._id } },
	);
});

export const Tables =
	mongoose.models?.tables ??
	mongoose.model<TTable>("tables", TableSchema);

export type TTable = {
	name: string;
	username: string;
	restaurantID: string;

	ready2orderTableId?: number;
	ready2orderTableAreaId?: number;
	ready2orderOrder: number;
	ready2orderCheckoutMode: boolean;
	ready2orderIsTemporary: boolean;

	description?: string;
	ready2orderUpdatedAt?: Date;

	qrToken?: string;
	qrUrl?: string;
};