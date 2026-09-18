import mongoose, { type HydratedDocument } from "mongoose";

import { Accounts, type TAccount } from "./account";

const accountCache = new Map<string, TAccount | null>();

const FoodType = ["spicy", "extra-spicy", "sweet"] as const;
const Veg = ["veg", "non-veg", "contains-egg"] as const;
export const OrderTypes = ["DINE_IN", "PICKUP", "DELIVERY"] as const;

const Ready2OrderVariationSchema = new mongoose.Schema<TReady2OrderVariation>(
	{
		productId: { type: Number, required: true },
		name: { type: String, trim: true, required: true },
		price: { type: Number, required: true },
	},
	{ _id: false },
);

const MenuSchema = new mongoose.Schema<TMenu>(
	{
		name: { type: String, trim: true, required: true },
		restaurantID: { type: String, trim: true, lowercase: true, required: true },

		ready2orderProductId: { type: Number, index: true },
		ready2orderProductType: { type: String, trim: true },
		ready2orderUpdatedAt: { type: Date },
		ready2orderVariations: { type: [Ready2OrderVariationSchema], default: [] },

		description: { type: String, trim: true },
		category: { type: String, trim: true, lowercase: true },
		price: { type: Number, trim: true, required: true },
		taxPercent: { type: Number, trim: true, required: true },
		foodType: { type: String, trim: true, lowercase: true, enum: FoodType },
		veg: { type: String, trim: true, lowercase: true, required: true, enum: Veg },
		image: { type: String, trim: true },
		hidden: { type: Boolean, default: true },
		availableOrderTypes: {
			type: [{ type: String, enum: OrderTypes }],
			default: ["DINE_IN"],
		},
	},
	{ timestamps: true },
);

MenuSchema.pre("save", async function () {
	let account = accountCache.get(this.restaurantID);
	if (!account) {
		account = await Accounts.findOne<TAccount>({ username: this.restaurantID }).populate("profile");
		if (account) accountCache.set(this.restaurantID, account);
		else throw new Error(`The associated account with username '${this.restaurantID}'does not exist.`);
	}
	if (!account?.profile?.categories?.includes(this.category)) throw new Error("The menu item category does not exist.");
});
MenuSchema.post("save", async function () {
	await Accounts.updateOne({ username: this.restaurantID }, { $addToSet: { menus: this._id } });
});
export const Menus = mongoose.models?.menus ?? mongoose.model<TMenu>("menus", MenuSchema);
export type TReady2OrderVariation = {
	productId: number;
	name: string;
	price: number;
};
export type TOrderType = (typeof OrderTypes)[number];
export type TMenu = HydratedDocument<{
	name: string;
	restaurantID: string;
	ready2orderProductId?: number;
	ready2orderProductType?: string;
	ready2orderUpdatedAt?: Date;
	ready2orderVariations: TReady2OrderVariation[];
	description: string;
	category: string;
	price: number;
	taxPercent: number;
	foodType: TFoodType;
	veg: TVeg;
	image: string;
	hidden: boolean;
	availableOrderTypes: TOrderType[];
}>;

export type TFoodType = (typeof FoodType)[number];
export type TVeg = (typeof Veg)[number];
