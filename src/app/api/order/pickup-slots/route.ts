import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Menus, type TMenu } from "#utils/database/models/menu";
import { Profiles } from "#utils/database/models/profile";
import { authOptions } from "#utils/helper/authHelper";
import { CatchNextResponse } from "#utils/helper/common";
import { buildPickupSlots, getPickupSettings } from "#utils/helper/pickupSlots";

const LEGACY_PICKUP_CATEGORIES = new Set(["burger", "pizza", "snacks", "salate", "nachspeisen", "oel", "most", "wein"]);

const isPickupAvailable = (menuItem: TMenu) => {
	if (Array.isArray(menuItem.availableOrderTypes)) return menuItem.availableOrderTypes.includes("PICKUP");
	return LEGACY_PICKUP_CATEGORIES.has(menuItem.category);
};

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session) throw { status: 401, message: "Authentication Required" };

		const restaurantID = session?.restaurant?.username;
		if (!restaurantID) throw { status: 400, message: "Restaurant wurde nicht gefunden." };

		const body = await req.json();
		const productIds = Array.isArray(body?.productIds)
			? Array.from(new Set(body.productIds.map((value: unknown) => String(value)))).slice(0, 100)
			: [];
		if (!productIds.length || productIds.some((id) => !mongoose.isValidObjectId(id))) {
			throw { status: 400, message: "Ungültige Produktauswahl." };
		}

		await connectDB();
		const [profile, products] = await Promise.all([
			Profiles.findOne({ restaurantID }).lean(),
			Menus.find({ restaurantID, _id: { $in: productIds } }).lean<TMenu[]>(),
		]);
		if (!profile) throw { status: 404, message: "Restaurantprofil wurde nicht gefunden." };
		if (products.length !== productIds.length) throw { status: 404, message: "Mindestens ein Produkt wurde nicht gefunden." };

		for (const product of products) {
			if (product.hidden || !isPickupAvailable(product)) {
				throw { status: 409, message: `'${product.name}' ist derzeit nicht für Abholung verfügbar.` };
			}
		}

		const categories = products.map((product) => product.category);
		const days = buildPickupSlots(profile, categories);
		const settings = getPickupSettings(profile);
		const paused = Boolean(profile.orderPause?.all || profile.orderPause?.pickup);

		return NextResponse.json({
			status: 200,
			paused,
			message: paused ? "Abholbestellungen sind derzeit pausiert." : days.length ? undefined : "Für diese Auswahl ist aktuell keine Abholzeit verfügbar.",
			days,
			settings,
		});
	} catch (err) {
		return CatchNextResponse(err);
	}
}

export const dynamic = "force-dynamic";
