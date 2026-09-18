import mongoose from "mongoose";

const CustomerLoginCodeSchema = new mongoose.Schema(
	{
		email: { type: String, required: true, trim: true, lowercase: true, index: true },
		codeHash: { type: String, required: true },
		expiresAt: { type: Date, required: true, index: { expires: 0 } },
		attempts: { type: Number, default: 0 },
		usedAt: { type: Date },
	},
	{ timestamps: true },
);

CustomerLoginCodeSchema.index({ email: 1, createdAt: -1 });

export const CustomerLoginCodes = mongoose.models?.customerLoginCodes ?? mongoose.model("customerLoginCodes", CustomerLoginCodeSchema);
