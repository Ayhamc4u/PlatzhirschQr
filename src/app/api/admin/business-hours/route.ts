import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import connectDB from "#utils/database/connect";
import { Profiles } from "#utils/database/models/profile";
import { authOptions } from "#utils/helper/authHelper";
import { validateWeeklySchedule } from "#utils/helper/businessHours";
import { CatchNextResponse } from "#utils/helper/common";

export async function POST(request: Request) {
	try {
		await connectDB();
		const session = await getServerSession(authOptions);
		if (!session || session.role !== "admin" || !session.username) throw { status: 401, message: "Authentication Required" };

		const body = await request.json();
		const { orderPause, openingHours, serviceHours } = body ?? {};
		const update: Record<string, unknown> = {};

		if (orderPause !== undefined) {
			if (!orderPause || typeof orderPause !== "object" || Array.isArray(orderPause)) throw { status: 400, message: "Ungültiger Bestellstatus" };
			if (typeof orderPause.all !== "boolean" || typeof orderPause.pickup !== "boolean" || typeof orderPause.dineIn !== "boolean") throw { status: 400, message: "Ungültiger Bestellstatus" };
			update.orderPause = orderPause;
		}
		if (openingHours !== undefined) {
			if (!validateWeeklySchedule(openingHours)) throw { status: 400, message: "Ungültige Öffnungszeiten" };
			update.openingHours = openingHours;
		}
		if (serviceHours !== undefined) {
			if (!validateWeeklySchedule(serviceHours)) throw { status: 400, message: "Ungültige Speise- und Servicezeiten" };
			update.serviceHours = serviceHours;
		}
		if (!Object.keys(update).length) throw { status: 400, message: "Keine Änderungen übermittelt" };

		const profile = await Profiles.findOneAndUpdate({ restaurantID: session.username }, { $set: update }, { new: true }).lean();
		if (!profile) throw { status: 404, message: "Restaurantprofil nicht gefunden" };

		return NextResponse.json({ orderPause: profile.orderPause, openingHours: profile.openingHours, serviceHours: profile.serviceHours });
	} catch (err) {
		return CatchNextResponse(err);
	}
}
