"use client";

import { useSession } from "next-auth/react";
import { type Dispatch, type ReactNode, type SetStateAction, type UIEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { useAdmin } from "#components/context/useContext";
import type { TOrderPause, TTimeRange, TWeeklySchedule } from "#utils/database/models/profile";
import { WEEK_DAYS } from "#utils/helper/businessHours";
import { useQueryParams } from "#utils/hooks/useQueryParams";

import NavTopBar from "./Orders/NavTopBar";
import Orders from "./Orders/Orders";
import MenuEditor from "./Settings/MenuEditor/MenuEditor";
import SettingsAccount from "./Settings/SettingsAccount";
import ThemeSettings from "./Settings/ThemeSettings";
import "./Settings/settings.scss";
import TablesQrOverview from "./TablesQrOverview";

const tabHeadings: Record<string, string> = {
	orders: "Orders",
	tables: "Tische",
	menu: "Menü",
	hours: "Geschäftszeiten",
	design: "Design",
	profile: "Profil",
};

export default function PageContainer() {
	const session = useSession();
	const [floatHeader, setFloatHeader] = useState(false);
	const queryParams = useQueryParams();
	const tab = queryParams.get("tab") ?? "";

	const onScroll = (event: UIEvent<HTMLDivElement>) => {
		if ((event.target as HTMLDivElement).scrollTop >= 1) return setFloatHeader(true);
		return setFloatHeader(false);
	};

	useEffect(() => {
		if (session.status === "unauthenticated") queryParams.router.replace("/");
		if (session?.data?.role === "kitchen") queryParams.router.replace("/kitchen");
	}, [queryParams.router, session]);

	const dashboardSections: Record<string, ReactNode> = {
		tables: <TablesQrOverview />,
		menu: <MenuEditor />,
		hours: <BusinessHours />,
		design: <ThemeSettings />,
		profile: <SettingsAccount />,
	};

	return (
		<div className={`dashboardViewport ${floatHeader ? "floatHeader" : ""}`}>
			<div className="dashboardHeader">
				<h1 className="dashboardHeading">{tabHeadings[tab] ?? tab}</h1>
				<NavTopBar />
			</div>
			<div className="dashboardContent">
				{tab === "orders" ? (
					<Orders onScroll={onScroll} />
				) : (
					<div className="settings" onScroll={onScroll}>
						{dashboardSections[tab]}
					</div>
				)}
			</div>
		</div>
	);
}

const days = [
	["monday", "Montag"],
	["tuesday", "Dienstag"],
	["wednesday", "Mittwoch"],
	["thursday", "Donnerstag"],
	["friday", "Freitag"],
	["saturday", "Samstag"],
	["sunday", "Sonntag"],
] as const;

const createDefaultSchedule = (): TWeeklySchedule => ({
	monday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }] },
	tuesday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }] },
	wednesday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }, { from: "17:00", to: "00:00" }] },
	thursday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }, { from: "17:00", to: "00:00" }] },
	friday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }, { from: "17:00", to: "00:00" }] },
	saturday: { closed: false, ranges: [{ from: "09:00", to: "13:00" }, { from: "17:00", to: "00:00" }] },
	sunday: { closed: true, ranges: [] },
});

const hasFullSchedule = (schedule?: TWeeklySchedule) => Boolean(schedule && WEEK_DAYS.every((day) => schedule[day]));

const BusinessHours = () => {
	const { profile, profileMutate } = useAdmin();
	const [orderPause, setOrderPause] = useState<TOrderPause>({ all: false, pickup: false, dineIn: false });
	const [openingHours, setOpeningHours] = useState<TWeeklySchedule>(() => createDefaultSchedule());
	const [serviceHours, setServiceHours] = useState<TWeeklySchedule>(() => createDefaultSchedule());
	const [pauseSaving, setPauseSaving] = useState(false);
	const [hoursSaving, setHoursSaving] = useState(false);

	useEffect(() => {
		if (profile?.orderPause) setOrderPause(profile.orderPause);
		if (hasFullSchedule(profile?.openingHours)) setOpeningHours(profile!.openingHours!);
		if (hasFullSchedule(profile?.serviceHours)) setServiceHours(profile!.serviceHours!);
	}, [profile]);

	const savePause = async (next: TOrderPause) => {
		if (pauseSaving) return;
		const previous = orderPause;
		setOrderPause(next);
		setPauseSaving(true);
		try {
			const req = await fetch("/api/admin/business-hours", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ orderPause: next }),
			});
			const res = await req.json();
			if (!req.ok) throw new Error(res?.message || "Bestellstatus konnte nicht gespeichert werden");
		} catch (error) {
			setOrderPause(previous);
			toast.error(error instanceof Error ? error.message : "Bestellstatus konnte nicht gespeichert werden");
		} finally {
			setPauseSaving(false);
		}
	};

	const saveHours = async () => {
		if (hoursSaving) return;
		setHoursSaving(true);
		try {
			const req = await fetch("/api/admin/business-hours", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ openingHours, serviceHours }),
			});
			const res = await req.json();
			if (!req.ok) throw new Error(res?.message || "Geschäftszeiten konnten nicht gespeichert werden");
			await profileMutate();
			toast.success("Geschäftszeiten gespeichert");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Geschäftszeiten konnten nicht gespeichert werden");
		} finally {
			setHoursSaving(false);
		}
	};

	return (
		<div className="businessHoursPage">
			<section className={`orderStatusCard ${orderPause.all ? "paused" : ""}`}>
				<div className="orderStatusIntro">
					<p className="businessHoursEyebrow">Bestellstatus</p>
					<h1>Bestellungen steuern</h1>
					<p>Die Pausen werden sofort gespeichert. Der Hauptschalter hat Vorrang vor den beiden Einzelpausen.</p>
				</div>
				<label className="pauseSwitch pauseSwitchMain">
					<span><strong>Alle Bestellungen pausieren</strong><small>Stoppt Abholung und Tischservice gleichzeitig.</small></span>
					<input type="checkbox" checked={orderPause.all} disabled={pauseSaving} onChange={(event) => savePause({ ...orderPause, all: event.target.checked })} />
					<i aria-hidden="true" />
				</label>
				<div className="pauseSubgrid">
					<label className="pauseSwitch">
						<span><strong>Abholung pausieren</strong><small>Nur Online-Abholung stoppen.</small></span>
						<input type="checkbox" checked={orderPause.pickup} disabled={orderPause.all || pauseSaving} onChange={(event) => savePause({ ...orderPause, pickup: event.target.checked })} />
						<i aria-hidden="true" />
					</label>
					<label className="pauseSwitch">
						<span><strong>Tischservice pausieren</strong><small>Nur Bestellungen am Tisch stoppen.</small></span>
						<input type="checkbox" checked={orderPause.dineIn} disabled={orderPause.all || pauseSaving} onChange={(event) => savePause({ ...orderPause, dineIn: event.target.checked })} />
						<i aria-hidden="true" />
					</label>
				</div>
			</section>

			<div className="hoursGrid">
				<ScheduleCard title="Öffnungszeiten" description="Wann das Lokal grundsätzlich geöffnet ist. Pro Tag sind bis zu zwei Zeitfenster möglich." schedule={openingHours} setSchedule={setOpeningHours} />
				<ScheduleCard title="Speise- & Servicezeiten" description="Wann Küche und Bestellservice grundsätzlich verfügbar sind. Kategoriezeiten können diese Zeiten später weiter einschränken." schedule={serviceHours} setSchedule={setServiceHours} />
			</div>
			<div className="hoursSaveBar">
				<p>Kategoriezeiten wie Pizza werden im Menü gepflegt und gelten zusätzlich zu diesen allgemeinen Servicezeiten.</p>
				<button type="button" disabled={hoursSaving} onClick={saveHours}>{hoursSaving ? "Speichert…" : "Geschäftszeiten speichern"}</button>
			</div>
		</div>
	);
};

const ScheduleCard = ({ title, description, schedule, setSchedule }: { title: string; description: string; schedule: TWeeklySchedule; setSchedule: Dispatch<SetStateAction<TWeeklySchedule>> }) => {
	const setClosed = (dayId: string, closed: boolean) => setSchedule((current) => ({
		...current,
		[dayId]: closed ? { closed: true, ranges: [] } : { closed: false, ranges: [{ from: "09:00", to: "13:00" }] },
	}));

	const setTime = (dayId: string, rangeIndex: number, field: keyof TTimeRange, value: string) => setSchedule((current) => ({
		...current,
		[dayId]: { ...current[dayId], ranges: current[dayId].ranges.map((range, index) => index === rangeIndex ? { ...range, [field]: value } : range) },
	}));

	const addRange = (dayId: string) => setSchedule((current) => current[dayId].ranges.length >= 2 ? current : ({
		...current,
		[dayId]: { ...current[dayId], ranges: [...current[dayId].ranges, { from: "17:00", to: "00:00" }] },
	}));

	const removeRange = (dayId: string, rangeIndex: number) => setSchedule((current) => {
		const ranges = current[dayId].ranges.filter((_, index) => index !== rangeIndex);
		return { ...current, [dayId]: { closed: ranges.length === 0, ranges } };
	});

	return (
		<section className="hoursCard">
			<header><h2>{title}</h2><p>{description}</p></header>
			<div className="hoursList">
				{days.map(([dayId, label]) => {
					const day = schedule[dayId];
					return (
						<div className={`hoursDay ${day.closed ? "closed" : ""}`} key={dayId}>
							<div className="hoursDayHead">
								<strong>{label}</strong>
								<label className="closedToggle"><input type="checkbox" checked={day.closed} onChange={(event) => setClosed(dayId, event.target.checked)} /><span>Geschlossen</span></label>
							</div>
							{day.closed ? <p className="closedLabel">An diesem Tag geschlossen</p> : (
								<div className="timeRanges">
									{day.ranges.map((range, index) => (
										<div className="timeRange" key={`${dayId}-${index}`}>
											<input type="time" aria-label={`${label} Beginn ${index + 1}`} value={range.from} onChange={(event) => setTime(dayId, index, "from", event.target.value)} />
											<span>–</span>
											<input type="time" aria-label={`${label} Ende ${index + 1}`} value={range.to} onChange={(event) => setTime(dayId, index, "to", event.target.value)} />
											{day.ranges.length > 1 ? <button type="button" className="removeRange" onClick={() => removeRange(dayId, index)} aria-label={`${label} Zeitfenster entfernen`}>×</button> : null}
										</div>
									))}
									{day.ranges.length < 2 ? <button type="button" className="addRange" onClick={() => addRange(dayId)}>+ Zweites Zeitfenster</button> : null}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
};
