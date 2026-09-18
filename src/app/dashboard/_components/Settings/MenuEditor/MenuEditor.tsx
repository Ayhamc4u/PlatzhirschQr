import { useEffect, useMemo, useState } from "react";

import { toast } from "react-toastify";
import { Spinner } from "xtreme-ui";

import { useAdmin } from "#components/context/useContext";
import type { TMenu } from "#utils/database/models/menu";
import type { TTimeRange, TWeeklySchedule } from "#utils/database/models/profile";
import { WEEK_DAYS } from "#utils/helper/businessHours";

import MenuEditorItem from "./MenuEditorItem";
import "./menuEditor.scss";
import "./categoryHours.scss";

const CATEGORY_LABELS: Record<string, string> = {
	fruehstueck: "Frühstück",
	burger: "Burger",
	pizza: "Pizza",
	snacks: "Snacks",
	salate: "Salate",
	nachspeisen: "Nachspeisen",
	"alkoholfreie-getraenke": "Alkoholfreie Getränke",
	"kaffee-und-tee": "Kaffee & Tee",
	biere: "Biere",
	spritzer: "Spritzer",
	longdrinks: "Longdrinks",
	spirituosen: "Spirituosen",
	flaschen: "Flaschen",
	weine: "Weine",
	"sekt-champagner": "Sekt & Champagner",
	gutscheine: "Gutscheine",
	oel: "Öl",
	most: "Most",
	wein: "Wein",
};

const DAY_LABELS: Record<string, string> = {
	monday: "Mo",
	tuesday: "Di",
	wednesday: "Mi",
	thursday: "Do",
	friday: "Fr",
	saturday: "Sa",
	sunday: "So",
};

type TAvailabilityState = {
	inactive: boolean;
	pickup: boolean;
	dineIn: boolean;
};

const getInitialAvailability = (items: TMenu[]): TAvailabilityState => {
	if (!items.length) return { inactive: true, pickup: false, dineIn: false };
	const activeItems = items.filter((item) => !item.hidden);
	if (!activeItems.length) return { inactive: true, pickup: false, dineIn: false };

	return {
		inactive: false,
		pickup: activeItems.length === items.length && activeItems.every((item) => item.availableOrderTypes?.includes("PICKUP")),
		dineIn: activeItems.length === items.length && activeItems.every((item) => item.availableOrderTypes?.includes("DINE_IN") || !Array.isArray(item.availableOrderTypes)),
	};
};

const toggleAvailability = (state: TAvailabilityState, key: keyof TAvailabilityState): TAvailabilityState => {
	if (key === "inactive") {
		if (!state.inactive) return { inactive: true, pickup: false, dineIn: false };
		return { inactive: false, pickup: false, dineIn: true };
	}

	const next = { ...state, inactive: false, [key]: !state[key] };
	if (!next.pickup && !next.dineIn) return { inactive: true, pickup: false, dineIn: false };
	return next;
};

const AvailabilityButtons = ({ state, onChange, disabled = false }: { state: TAvailabilityState; onChange: (state: TAvailabilityState) => void; disabled?: boolean }) => (
	<div className={`adminAvailability ${disabled ? "saving" : ""}`} role="group" aria-label="Verfügbarkeit">
		<button type="button" disabled={disabled} className={state.inactive ? "active inactive" : "inactive"} aria-pressed={state.inactive} onClick={() => onChange(toggleAvailability(state, "inactive"))}>Inaktiv</button>
		<button type="button" disabled={disabled} className={state.pickup ? "active" : ""} aria-pressed={state.pickup} onClick={() => onChange(toggleAvailability(state, "pickup"))}>Abholung</button>
		<button type="button" disabled={disabled} className={state.dineIn ? "active" : ""} aria-pressed={state.dineIn} onClick={() => onChange(toggleAvailability(state, "dineIn"))}>Am Tisch</button>
	</div>
);

const cloneSchedule = (schedule: TWeeklySchedule): TWeeklySchedule => JSON.parse(JSON.stringify(schedule)) as TWeeklySchedule;
const hasFullSchedule = (schedule?: TWeeklySchedule) => Boolean(schedule && WEEK_DAYS.every((day) => schedule[day]));
const createClosedSchedule = (): TWeeklySchedule => Object.fromEntries(WEEK_DAYS.map((day) => [day, { closed: true, ranges: [] }])) as TWeeklySchedule;

const CategoryHoursEditor = ({ category, label }: { category: string; label: string }) => {
	const { profile, profileMutate } = useAdmin();
	const savedSchedule = profile?.categoryAvailability?.[category];
	const [custom, setCustom] = useState(Boolean(savedSchedule));
	const [schedule, setSchedule] = useState<TWeeklySchedule>(() => savedSchedule ? cloneSchedule(savedSchedule) : hasFullSchedule(profile?.serviceHours) ? cloneSchedule(profile!.serviceHours!) : createClosedSchedule());
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const next = profile?.categoryAvailability?.[category];
		setCustom(Boolean(next));
		if (next) setSchedule(cloneSchedule(next));
	}, [category, profile]);

	const setClosed = (day: string, closed: boolean) => setSchedule((current) => ({
		...current,
		[day]: closed ? { closed: true, ranges: [] } : { closed: false, ranges: [{ from: "11:30", to: "13:00" }] },
	}));

	const setTime = (day: string, index: number, field: keyof TTimeRange, value: string) => setSchedule((current) => ({
		...current,
		[day]: { ...current[day], ranges: current[day].ranges.map((range, rangeIndex) => rangeIndex === index ? { ...range, [field]: value } : range) },
	}));

	const addRange = (day: string) => setSchedule((current) => current[day].ranges.length >= 2 ? current : ({
		...current,
		[day]: { ...current[day], ranges: [...current[day].ranges, { from: "17:00", to: "21:00" }] },
	}));

	const removeRange = (day: string, index: number) => setSchedule((current) => {
		const ranges = current[day].ranges.filter((_, rangeIndex) => rangeIndex !== index);
		return { ...current, [day]: { closed: ranges.length === 0, ranges } };
	});

	const save = async (nextSchedule: TWeeklySchedule | null) => {
		if (saving) return;
		setSaving(true);
		try {
			const req = await fetch("/api/admin/menu/category-hours", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ category, schedule: nextSchedule }),
			});
			const res = await req.json();
			if (!req.ok) throw new Error(res?.message || "Kategoriezeiten konnten nicht gespeichert werden");
			setCustom(Boolean(nextSchedule));
			await profileMutate();
			toast.success(nextSchedule ? `${label}: Zeiten gespeichert` : `${label}: allgemeine Servicezeiten aktiv`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Kategoriezeiten konnten nicht gespeichert werden");
		} finally {
			setSaving(false);
		}
	};

	const enableCustom = () => {
		const base = hasFullSchedule(profile?.serviceHours) ? cloneSchedule(profile!.serviceHours!) : createClosedSchedule();
		setSchedule(base);
		setCustom(true);
	};

	return (
		<div className="categoryHoursEditor">
			<div className="categoryHoursMode">
				<button type="button" className={!custom ? "active" : ""} disabled={saving} onClick={() => save(null)}>Allgemeine Servicezeiten</button>
				<button type="button" className={custom ? "active" : ""} disabled={saving} onClick={enableCustom}>Eigene Zeiten</button>
			</div>
			{custom ? (
				<>
					<div className="categoryHoursDays">
						{WEEK_DAYS.map((day) => {
							const daySchedule = schedule[day];
							return (
								<div className={`categoryHoursDay ${daySchedule.closed ? "closed" : ""}`} key={day}>
									<div className="categoryHoursDayHead">
										<strong>{DAY_LABELS[day]}</strong>
										<label><input type="checkbox" checked={daySchedule.closed} onChange={(event) => setClosed(day, event.target.checked)} /> geschlossen</label>
									</div>
									{!daySchedule.closed ? (
										<div className="categoryHoursRanges">
											{daySchedule.ranges.map((range, index) => (
												<div className="categoryHoursRange" key={`${day}-${index}`}>
													<input type="time" value={range.from} onChange={(event) => setTime(day, index, "from", event.target.value)} />
													<span>–</span>
													<input type="time" value={range.to} onChange={(event) => setTime(day, index, "to", event.target.value)} />
													{daySchedule.ranges.length > 1 ? <button type="button" onClick={() => removeRange(day, index)} aria-label="Zeitfenster entfernen">×</button> : null}
												</div>
											))}
											{daySchedule.ranges.length < 2 ? <button type="button" className="categoryAddRange" onClick={() => addRange(day)}>+ Zeitfenster</button> : null}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
					<button type="button" className="categoryHoursSave" disabled={saving} onClick={() => save(schedule)}>{saving ? "Speichert…" : "Kategoriezeiten speichern"}</button>
				</>
			) : <p className="categoryHoursInherited">Diese Kategorie folgt automatisch den allgemeinen Speise- & Servicezeiten.</p>}
		</div>
	);
};

const CategoryCard = ({ id, label, items, active, onSelect }: { id: string; label: string; items: TMenu[]; active: boolean; onSelect: () => void }) => {
	const { profileMutate, profile } = useAdmin();
	const [availability, setAvailability] = useState<TAvailabilityState>(() => getInitialAvailability(items));
	const [saving, setSaving] = useState(false);
	const [hoursOpen, setHoursOpen] = useState(false);

	useEffect(() => {
		setAvailability(getInitialAvailability(items));
	}, [items]);

	const saveAvailability = async (next: TAvailabilityState) => {
		if (saving) return;
		setSaving(true);
		const previous = availability;
		setAvailability(next);

		try {
			const req = await fetch("/api/admin/menu/availability", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					category: id,
					hidden: next.inactive,
					availableOrderTypes: next.inactive ? [] : [next.pickup ? "PICKUP" : null, next.dineIn ? "DINE_IN" : null].filter(Boolean),
				}),
			});
			const res = await req.json();
			if (!req.ok) throw new Error(res?.message || "Kategorie konnte nicht gespeichert werden");
			await profileMutate();
		} catch (error) {
			setAvailability(previous);
			toast.error(error instanceof Error ? error.message : "Kategorie konnte nicht gespeichert werden");
		} finally {
			setSaving(false);
		}
	};

	const hasCustomHours = Boolean(profile?.categoryAvailability?.[id]);

	return (
		<div className={`adminCategoryCard ${active ? "active" : ""} ${hoursOpen ? "hoursOpen" : ""}`}>
			<button type="button" className="adminCategorySelect" aria-pressed={active} onClick={onSelect}>
				<span>{label}</span>
				<small>{items.length} Produkt{items.length === 1 ? "" : "e"}{hasCustomHours ? " · eigene Zeiten" : ""}</small>
			</button>
			<AvailabilityButtons state={availability} onChange={saveAvailability} disabled={saving} />
			<button type="button" className={`categoryHoursToggle ${hasCustomHours ? "custom" : ""}`} aria-expanded={hoursOpen} onClick={() => setHoursOpen((current) => !current)}>
				Zeiten {hoursOpen ? "schließen" : "bearbeiten"}
			</button>
			{hoursOpen ? <CategoryHoursEditor category={id} label={label} /> : null}
		</div>
	);
};

const MenuEditor = () => {
	const { menus, profileLoading } = useAdmin();
	const categories = useMemo(() => {
		const map = new Map<string, TMenu[]>();
		menus.forEach((item) => {
			const category = item.category || "ohne-kategorie";
			map.set(category, [...(map.get(category) ?? []), item]);
		});
		return Array.from(map.entries()).map(([id, items]) => ({ id, label: CATEGORY_LABELS[id] ?? id.replace(/-/g, " "), items }));
	}, [menus]);
	const [category, setCategory] = useState("burger");

	useEffect(() => {
		if (!categories.length) return;
		if (!categories.some((item) => item.id === category)) setCategory(categories[0].id);
	}, [categories, category]);

	const visibleMenus = menus.filter((item) => item.category === category);

	if (profileLoading) return <Spinner fullpage label="Menü wird geladen..." />;

	return (
		<div className="menuEditor">
			<section className="menuCategoryEditor" aria-label="Menükategorien">
				<div className="menuCategoryContainer">
					{categories.map((item) => (
						<CategoryCard key={item.id} id={item.id} label={item.label} items={item.items} active={category === item.id} onSelect={() => setCategory(item.id)} />
					))}
				</div>
			</section>

			<section className="menuItemEditor">
				<div className="menuItemHeader">
					<div>
						<p className="menuEditorEyebrow">Admin Menü</p>
						<h1 className="menuItemHeading">Unser Menü</h1>
					</div>
					<p className="menuEditorHint">Freigaben werden sofort gespeichert. Kategoriezeiten schränken die allgemeinen Servicezeiten zusätzlich ein.</p>
				</div>
				<div className="menuItemContainer">
					{visibleMenus.map((item) => (
						<MenuEditorItem key={item._id.toString()} item={item} />
					))}
				</div>
			</section>
		</div>
	);
};

export default MenuEditor;
