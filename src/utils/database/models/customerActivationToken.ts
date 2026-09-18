import mongoose, { type HydratedDocument } from "mongoose";

const CustomerActivationTokenSchema = new mongoose.Schema<TCustomerActivationToken>(
	{
		email: { type: String, required: true, lowercase: true, trim: true, index: true },
		tokenHash: { type: String, required: true, unique: true, index: true },
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
		usedAt: { type: Date },
	},
	{ timestamps: true },
);

export const CustomerActivationTokens = mongoose.models?.customerActivationTokens ?? mongoose.model<TCustomerActivationToken>("customerActivationTokens", CustomerActivationTokenSchema);

export type TCustomerActivationToken = HydratedDocument<{
	email: string;
	tokenHash: string;
	expiresAt: Date;
	usedAt?: Date;
}>;
