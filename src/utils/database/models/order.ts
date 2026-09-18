import mongoose, { type HydratedDocument } from "mongoose";

import type { TCustomer } from "./customer";
import type { TMenu, TOrderType } from "./menu";

const orderState = ["active", "reject", "cancel", "complete"] as const;
const approvalMode = ["auto", "manual"] as const;
const orderType = ["DINE_IN", "PICKUP", "DELIVERY"] as const;

const SelectedVariationSchema = new mongoose.Schema<TSelectedVariation>(
	{
		productId: { type: Number, required: true },
		name: { type: String, trim: true, required: true },
		price: { type: Number, required: true },
	},
	{ _id: false },
);

const CustomerSnapshotSchema = new mongoose.Schema<TCustomerSnapshot>(
	{
		fname: { type: String, trim: true },
		lname: { type: String, trim: true },
		phone: { type: String, trim: true },
		email: { type: String, trim: true, lowercase: true },
	},
	{ _id: false },
);

const OrderSchema = new mongoose.Schema<TOrder>(
	{
		restaurantID: { type: String, trim: true, lowercase: true, required: true },
		orderType: { type: String, enum: orderType, required: true, default: "DINE_IN" },
		table: { type: String, trim: true, lowercase: true, required: true },
		customer: { type: mongoose.Schema.Types.ObjectId, ref: "customers" },
		customerSnapshot: { type: CustomerSnapshotSchema },
		state: { type: String, trim: true, lowercase: true, enum: orderState, default: "active" },
		approvalMode: { type: String, enum: approvalMode, default: "manual" },
		requestedPickupAt: { type: Date },
		estimatedReadyAt: { type: Date },
		estimatedMinutes: { type: Number },
		orderTotal: { type: Number },
		taxTotal: { type: Number },
		ready2orderTableId: { type: Number },
		ready2orderOrderIds: [{ type: Number }],
		ready2orderSubmittedAt: { type: Date },
		ready2orderTrainingMode: { type: Boolean, default: false },
		products: [
			{
				product: { type: mongoose.Schema.Types.ObjectId, ref: "menus" },
				quantity: { type: Number, default: 1 },
				price: { type: Number, required: true },
				tax: { type: Number, required: true },
				comment: { type: String, trim: true, maxlength: 500, default: "" },
				selectedVariations: { type: [SelectedVariationSchema], default: [] },
				adminApproved: { type: Boolean, default: false },
				fulfilled: { type: Boolean, default: false },
			},
		],
	},
	{ timestamps: true },
);

OrderSchema.pre("save", function () {
	this.orderTotal = 0;
	this.taxTotal = 0;
	this?.products?.forEach(({ quantity, price, tax }) => {
		this.orderTotal += price * quantity;
		this.taxTotal += tax * quantity;
	});
});

OrderSchema.pre("save", async function () {
	if (!this.isNew || this.customerSnapshot || !this.customer) return;
	const CustomerModel = mongoose.models.customers;
	if (!CustomerModel) return;

	const customerId = (this.customer as unknown as { _id?: mongoose.Types.ObjectId })._id ?? this.customer;
	const customer = await CustomerModel.findById(customerId).select("fname lname phone email").lean();
	if (!customer) return;

	this.customerSnapshot = {
		fname: customer.fname,
		lname: customer.lname,
		phone: customer.phone,
		email: customer.email,
	};
});

export const Orders = mongoose.models?.orders ?? mongoose.model<TOrder>("orders", OrderSchema);
export type TSelectedVariation = {
	productId: number;
	name: string;
	price: number;
};
export type TCustomerSnapshot = {
	fname?: string;
	lname?: string;
	phone?: string;
	email?: string;
};
export type TOrder = HydratedDocument<{
	restaurantID: string;
	orderType: TOrderType;
	table: string;
	customer: TCustomer;
	customerSnapshot?: TCustomerSnapshot;
	state: (typeof orderState)[number];
	approvalMode: (typeof approvalMode)[number];
	requestedPickupAt?: Date;
	estimatedReadyAt?: Date;
	estimatedMinutes?: number;
	orderTotal: number;
	taxTotal: number;
	ready2orderTableId?: number;
	ready2orderOrderIds: number[];
	ready2orderSubmittedAt?: Date;
	ready2orderTrainingMode: boolean;
	products: Array<TProduct>;
	createdAt: Date;
	updatedAt: Date;
}>;

export type TProduct = TMenu & {
	_id: mongoose.Types.ObjectId;
	product: TMenu;
	quantity: number;
	price: number;
	tax: number;
	comment?: string;
	selectedVariations?: TSelectedVariation[];
	fulfilled: boolean;
	adminApproved: boolean;
};
