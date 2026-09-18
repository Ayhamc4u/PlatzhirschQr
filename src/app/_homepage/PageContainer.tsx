"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { ThemeSwitcher } from "#components/context/Theme";

import "../home.scss";

type PickupAvailability = {
	available: boolean;
	estimatedMinutes: number;
	readyAt: string;
	queueAhead: number;
	activeFoodOrders: number;
	maxActivePickups: number;
	autoAccept: boolean;
	requiresConfirmation: boolean;
	updatedAt: string;
	activeOrderMaxAgeMinutes: number;
	stalePickupOrdersCompleted: number;
	pickupTable: { username: string; name: string; pickupNumber?: number; autoBookable?: boolean } | null;
};

const PICKUP_REFRESH_INTERVAL_MS = 15_000;

export default function PageContainer() {
	const session = useSession();
	const [pickup, setPickup] = useState<PickupAvailability | null>(null);
	const isCustomer = session.data?.role === "customer";
	const accountHref = isCustomer ? "/platzhirsch/account" : "/platzhirsch/account/login";

	useEffect(() => {
		let active = true;

		const loadAvailability = async () => {
			try {
				const response = await fetch("/api/pickup/availability", { cache: "no-store" });
				if (!response.ok) return;
				const data = (await response.json()) as PickupAvailability;
				if (active) setPickup(data);
			} catch {
				// Die Startseite bleibt auch ohne Live-Schätzung nutzbar.
			}
		};

		const refreshWhenVisible = () => {
			if (document.visibilityState === "visible") loadAvailability();
		};

		loadAvailability();
		const interval = window.setInterval(loadAvailability, PICKUP_REFRESH_INTERVAL_MS);
		window.addEventListener("focus", loadAvailability);
		document.addEventListener("visibilitychange", refreshWhenVisible);

		return () => {
			active = false;
			window.clearInterval(interval);
			window.removeEventListener("focus", loadAvailability);
			document.removeEventListener("visibilitychange", refreshWhenVisible);
		};
	}, []);

	const pickupHref = useMemo(() => {
		const params = new URLSearchParams({ pickup: "1", tab: "menu" });
		if (pickup?.pickupTable?.username) params.set("pickupTable", pickup.pickupTable.username);
		return `/platzhirsch?${params.toString()}`;
	}, [pickup?.pickupTable?.username]);

	const readyTime = pickup?.readyAt
		? new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" }).format(new Date(pickup.readyAt))
		: null;

	const updatedTime = pickup?.updatedAt
		? new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(pickup.updatedAt))
		: null;

	const statusText = !pickup
		? "wird berechnet …"
		: !pickup.available
			? "derzeit nicht verfügbar"
			: `ca. ${pickup.estimatedMinutes} Minuten`;

	const queueText = !pickup
		? "–"
		: pickup.queueAhead === 0
			? "Keine Abholung vor dir"
			: pickup.queueAhead === 1
				? "1 Abholung vor dir"
				: `${pickup.queueAhead} Abholungen vor dir`;

	return (
		<main className="platzhirschHome">
			<div className="homeAccountBar">
				<span>{isCustomer ? `Angemeldet${session.data?.customer?.fname ? ` als ${session.data.customer.fname}` : ""}` : "Schon Stammkunde?"}</span>
				<a href={accountHref}>{isCustomer ? "Mein Konto" : "Anmelden"}</a>
				<ThemeSwitcher />
			</div>

			<section className="platzhirschHero">
				<div className="platzhirschEyebrow">Platzhirsch · Zwettl an der Rodl</div>
				<h1>Einfach bestellen.</h1>
				<p className="heroIntro">Online zur Abholung bestellen oder direkt am Tisch über den QR-Code.</p>

				<div className="pickupStatus" aria-live="polite">
					<div>
						<span className="statusLabel">Abholung</span>
						<strong>{statusText}</strong>
					</div>
					<div>
						<span className="statusLabel">Frühestens fertig</span>
						<strong>{pickup?.available ? readyTime ?? "–" : "–"}</strong>
					</div>
					<div>
						<span className="statusLabel">Warteschlange</span>
						<strong>{queueText}</strong>
					</div>
				</div>

				{updatedTime && <span className="pickupUpdatedAt">Live aktualisiert · {updatedTime}</span>}

				{pickup && !pickup.available && (
					<p className="pickupHint">Unsere Abholkapazität ist gerade ausgeschöpft. Bitte versuche es etwas später noch einmal.</p>
				)}

				{pickup?.available && pickup.autoAccept && (
					<p className="pickupHint">Deine Bestellung kann sofort bestätigt werden und ist voraussichtlich gegen {readyTime} Uhr abholbereit.</p>
				)}

				{pickup?.available && pickup.requiresConfirmation && (
					<p className="pickupHint">Aktuell ist mehr los. Wir prüfen deine gewünschte Abholung kurz und bestätigen sie anschließend manuell.</p>
				)}

				<div className="platzhirschActions">
					{pickup?.available !== false ? (
						<a className="primaryAction" href={pickupHref}>
							{pickup ? `Zur Abholung · ca. ${pickup.estimatedMinutes} Min.` : "Online zur Abholung"}
						</a>
					) : (
						<span className="primaryAction disabledAction" aria-disabled="true">Derzeit keine Abholung verfügbar</span>
					)}
					<a className="secondaryAction" href="/scan">QR-Code scannen</a>
					<a className="accountAction" href={accountHref}>{isCustomer ? "Meine Bestellungen" : "Stammkunden-Login"}</a>
				</div>
			</section>

			<section className="platzhirschInfo" aria-label="Bestellmöglichkeiten">
				<div>
					<span className="infoNumber">01</span>
					<strong>Abholung</strong>
					<span>Bis zu fünf Abholbestellungen können automatisch bestätigt werden. Bei höherer Auslastung prüfen wir deine Bestellung persönlich.</span>
				</div>
				<div>
					<span className="infoNumber">02</span>
					<strong>Im Lokal</strong>
					<span>QR-Code am Tisch öffnen, Speisen und Getränke auswählen und direkt bestellen.</span>
				</div>
			</section>
		</main>
	);
}
