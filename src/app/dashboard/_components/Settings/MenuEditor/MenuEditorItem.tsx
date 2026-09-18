import { useEffect, useState } from "react";

import { toast } from "react-toastify";

import { useAdmin } from "#components/context/useContext";
import type { TMenu } from "#utils/database/models/menu";
import { formatEuro } from "#utils/helper/currency";

import "./menuEditorItem.scss";

type TAvailabilityState = {
	inactive: boolean;
	pickup: boolean;
	dineIn: boolean;
};

const getInitialAvailability = (item: TMenu): TAvailabilityState => ({
	inactive: Boolean(item.hidden),
	pickup: !item.hidden && Boolean(item.availableOrderTypes?.includes("PICKUP")),
	dineIn: !item.hidden && (Boolean(item.availableOrderTypes?.includes("DINE_IN")) || !Array.isArray(item.availableOrderTypes)),
});

const toggleAvailability = (state: TAvailabilityState, key: keyof TAvailabilityState): TAvailabilityState => {
	if (key === "inactive") {
		if (!state.inactive) return { inactive: true, pickup: false, dineIn: false };
		return { inactive: false, pickup: false, dineIn: true };
	}

	const next = { ...state, inactive: false, [key]: !state[key] };
	if (!next.pickup && !next.dineIn) return { inactive: true, pickup: false, dineIn: false };
	return next;
};

const MenuEditorItem = ({ item }: { item: TMenu }) => {
	const { profileMutate } = useAdmin();
	const [availability, setAvailability] = useState<TAvailabilityState>(() => getInitialAvailability(item));
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setAvailability(getInitialAvailability(item));
	}, [item]);

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
					itemId: item._id.toString(),
					hidden: next.inactive,
					availableOrderTypes: next.inactive ? [] : [next.pickup ? "PICKUP" : null, next.dineIn ? "DINE_IN" : null].filter(Boolean),
				}),
			});
			const res = await req.json();
			if (!req.ok) throw new Error(res?.message || "Verfügbarkeit konnte nicht gespeichert werden");
			await profileMutate();
		} catch (error) {
			setAvailability(previous);
			toast.error(error instanceof Error ? error.message : "Verfügbarkeit konnte nicht gespeichert werden");
		} finally {
			setSaving(false);
		}
	};

	return (
		<article className={`menuEditorItem ${!item.image ? "withoutImage" : ""}`}>
			{item.image ? (
				<div className="menuItemPicture" aria-hidden="true">
					<span style={{ backgroundImage: `url(${item.image})` }} />
				</div>
			) : null}

			<div className="menuItemContent">
				<div className="menuItemCopy">
					<h2>{item.name}</h2>
					{item.description ? <p>{item.description}</p> : null}
				</div>

				<div className="menuItemFooter">
					<strong className="menuItemPrice">{formatEuro(item.price)}</strong>
					<div className={`productAvailability ${saving ? "saving" : ""}`} role="group" aria-label={`Verfügbarkeit für ${item.name}`}>
						<button type="button" disabled={saving} className={availability.inactive ? "active inactive" : "inactive"} aria-pressed={availability.inactive} onClick={() => saveAvailability(toggleAvailability(availability, "inactive"))}>
							Inaktiv
						</button>
						<button type="button" disabled={saving} className={availability.pickup ? "active" : ""} aria-pressed={availability.pickup} onClick={() => saveAvailability(toggleAvailability(availability, "pickup"))}>
							Abholung
						</button>
						<button type="button" disabled={saving} className={availability.dineIn ? "active" : ""} aria-pressed={availability.dineIn} onClick={() => saveAvailability(toggleAvailability(availability, "dineIn"))}>
							Am Tisch
						</button>
					</div>
				</div>
			</div>
		</article>
	);
};

export default MenuEditorItem;
