import mongoose, { type HydratedDocument } from "mongoose";

const gender = ["male", "female", "others"] as const;
const newsletterStatus = ["NOT_REQUESTED", "PENDING", "SUBSCRIBED", "UNSUBSCRIBED"] as const;

const NewsletterConsentSchema = new mongoose.Schema(
	{
		status: { type: String, enum: newsletterStatus, default: "NOT_REQUESTED" },
		requestedAt: { type: Date },
		confirmedAt: { type: Date },
		unsubscribedAt: { type: Date },
		consentVersion: { type: String, trim: true },
		source: { type: String, trim: true },
	},
	{ _id: false },
);

const CustomerSchema = new mongoose.Schema<TCustomer>(
	{
		fname: { type: String, trim: true },
		lname: { type: String, trim: true },
		phone: { type: String, trim: true, unique: true, sparse: true, index: { unique: true } },
		phoneNormalized: { type: String, trim: true, sparse: true, index: true },
		phoneVerifiedAt: { type: Date },
		email: { type: String, trim: true, lowercase: true, unique: true, sparse: true, index: { unique: true } },
		emailNormalized: { type: String, trim: true, lowercase: true, sparse: true, index: true },
		emailVerifiedAt: { type: Date },
		passwordHash: { type: String, select: false },
		accountActivatedAt: { type: Date },
		gender: { type: String, trim: true, lowercase: true, enum: gender },
		accountEnabled: { type: Boolean, default: false },
		accountStatus: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" },
		lastLoginAt: { type: Date },
		newsletter: { type: NewsletterConsentSchema, default: () => ({ status: "NOT_REQUESTED" }) },
	},
	{ timestamps: true },
);

export const Customers = mongoose.models?.customers ?? mongoose.model<TCustomer>("customers", CustomerSchema);
export type TCustomer = HydratedDocument<{
	fname?: string;
	lname?: string;
	gender?: (typeof gender)[number];
	phone?: string;
	phoneNormalized?: string;
	phoneVerifiedAt?: Date;
	email?: string;
	emailNormalized?: string;
	emailVerifiedAt?: Date;
	passwordHash?: string;
	accountActivatedAt?: Date;
	accountEnabled: boolean;
	accountStatus: "ACTIVE" | "DISABLED";
	lastLoginAt?: Date;
	newsletter?: {
		status: (typeof newsletterStatus)[number];
		requestedAt?: Date;
		confirmedAt?: Date;
		unsubscribedAt?: Date;
		consentVersion?: string;
		source?: string;
	};
}>;
