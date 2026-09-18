import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Lottie } from "xtreme-ui";

import { useOrder } from "#components/context/useContext";
import Collapsible from "#components/layout/Collapsible";
import NoContent from "#components/layout/NoContent";
import { getAnimSrc } from "#utils/constants/common";
import type { TMenu } from "#utils/database/models/menu.js";
import type { TSelectedVariation } from "#utils/database/models/order";
import { formatEuro } from "#utils/helper/currency";

import ItemCard from "../../../../components/layout/ItemCard";

import "./cartPage.scss";

type TPickupSlot = { at: string; label: string };
type TPickupSlotDay = { date: string; label: string; slots: TPickupSlot[] };

const CartPage = (props: TCartPageProps) => {
	const { selectedProducts, increaseProductQuantity, decreaseProductQuantity, updateProductOptions, resetSelectedProducts } = props;
	const params = useSearchParams();
	const table = props.tableOverride ?? params.get("table");
	const { order, placeOrder, placingOrder, cancelOrder, cancelingOrder } = useOrder();
	const [showOrderHistory, setShowOrderHistory] = useState(false);
	const [confirmOrder, setConfirmOrder] = useState(false);
	const [pickupDays, setPickupDays] = useState<TPickupSlotDay[]>([]);
	const [pickupDay, setPickupDay] = useState("");
	const [requestedPickupAt, setRequestedPickupAt] = useState("");
	const [pickupSlotsLoading, setPickupSlotsLoading] = useState(false);
	const [pickupSlotsMessage, setPickupSlotsMessage] = useState("");

	const approvedProducts = order?.products?.reduce((acc, product) => (product.adminApproved ? acc + 1 : acc), 0);
	const selectionTotal = selectedProducts.reduce((total, product) => {
		const extras = (product.selectedVariations ?? []).reduce((sum, variation) => sum + variation.price, 0);
		return total + product.quantity * (product.price + extras);
	}, 0);
	const selectionQuantity = selectedProducts.reduce((total, product) => total + product.quantity, 0);
	const pickupOrder = props.pickup ? order : null;
	const pickupReadyTime = pickupOrder?.estimatedReadyAt
		? new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit" }).format(new Date(pickupOrder.estimatedReadyAt))
		: null;
	const selectedPickupDay = pickupDays.find((day) => day.date === pickupDay) ?? pickupDays[0];
	const requestedPickupLabel = requestedPickupAt
		? new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(requestedPickupAt))
		: "";
	const productIdsKey = useMemo(() => selectedProducts.map((product) => String(product._id)).sort().join(","), [selectedProducts]);

	const onOrderAction = async () => {
		if (!selectedProducts.length) return;
		if (props.pickup && !requestedPickupAt) return;
		const placed = await placeOrder(selectedProducts, {
			orderType: props.pickup ? "PICKUP" : "DINE_IN",
			table,
			requestedPickupAt: props.pickup ? requestedPickupAt : undefined,
		});
		if (!placed) return;
		resetSelectedProducts();
		setConfirmOrder(false);
	};

	const onCancelOrder = async () => {
		await cancelOrder();
		resetSelectedProducts();
	};

	const toggleVariation = (product: TMenuCustom, variation: TSelectedVariation) => {
		const current = product.selectedVariations ?? [];
		const selected = current.some((item) => item.productId === variation.productId);
		const selectedVariations = selected
			? current.filter((item) => item.productId !== variation.productId)
			: [...current, variation];
		updateProductOptions(String(product._id), { selectedVariations });
	};

	useEffect(() => {
		setShowOrderHistory(!selectedProducts.length);
	}, [selectedProducts.length]);

	useEffect(() => {
		props.setSideSheetHeading(confirmOrder ? ["Bestellung", "abschließen"] : ["Deine", "Bestellung"]);
	}, [confirmOrder, props.setSideSheetHeading]);

	useEffect(() => {
		if (!props.pickup || !productIdsKey) {
			setPickupDays([]);
			setPickupDay("");
			setRequestedPickupAt("");
			setPickupSlotsMessage("");
			return;
		}

		const controller = new AbortController();
		const loadPickupSlots = async () => {
			setPickupSlotsLoading(true);
			setPickupSlotsMessage("");
			try {
				const response = await fetch("/api/order/pickup-slots", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ productIds: productIdsKey.split(",") }),
					signal: controller.signal,
				});
				const data = await response.json();
				if (!response.ok) throw new Error(data?.message || "Abholzeiten konnten nicht geladen werden.");

				const days = Array.isArray(data?.days) ? data.days as TPickupSlotDay[] : [];
				setPickupDays(days);
				setPickupSlotsMessage(data?.message || "");
				const availableSlots = days.flatMap((day) => day.slots);
				setRequestedPickupAt((current) => availableSlots.some((slot) => slot.at === current) ? current : availableSlots[0]?.at ?? "");
				setPickupDay((current) => days.some((day) => day.date === current) ? current : days[0]?.date ?? "");
			} catch (error) {
				if (controller.signal.aborted) return;
				setPickupDays([]);
				setPickupDay("");
				setRequestedPickupAt("");
				setPickupSlotsMessage(error instanceof Error ? error.message : "Abholzeiten konnten nicht geladen werden.");
			} finally {
				if (!controller.signal.aborted) setPickupSlotsLoading(false);
			}
		};
		loadPickupSlots();
		return () => controller.abort();
	}, [props.pickup, productIdsKey]);

	if (!selectedProducts.length && !order?.products?.length) {
		return <div className="cartPage"><NoContent label="Noch nichts im Warenkorb" animationName="FoodBurgerHappy" /></div>;
	}

	if (order?.products?.length && approvedProducts === 0) {
		return (
			<div className="cartPage">
				<div className="cartApproval">
					<Lottie className="burgerLoader" src={getAnimSrc("FoodCook")} size={250} />
					<div className="approvalHeading">
						<p>Deine Bestellung</p>
						<p>{props.pickup ? "wartet auf unsere Bestätigung" : "wird gleich angenommen"}</p>
						{props.pickup && order.requestedPickupAt && <p>Gewünschte Abholung: {new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(new Date(order.requestedPickupAt))} Uhr.</p>}
						{props.pickup && !order.requestedPickupAt && order.estimatedMinutes && <p>Aktuelle Schätzung: ca. {order.estimatedMinutes} Minuten.</p>}
					</div>
					<Button className="endOrder" type="secondaryDanger" size="mini" label="Bestellung stornieren" loading={cancelingOrder} onClick={onCancelOrder} />
				</div>
			</div>
		);
	}

	if (confirmOrder && selectedProducts.length > 0) {
		return (
			<div className="cartPage confirmationPage">
				<div className="confirmationScroll">
					<div className="confirmationIntro">
						<strong>Passt alles?</strong>
						<span>Mit „Jetzt bestellen“ wird deine Bestellung fix an den Platzhirsch gesendet.</span>
					</div>

					{props.pickup && requestedPickupLabel && (
						<div className="confirmationPickupTime"><span>Abholung</span><strong>{requestedPickupLabel} Uhr</strong></div>
					)}

					<div className="confirmationList">
						{selectedProducts.map((product) => {
							const extrasTotal = (product.selectedVariations ?? []).reduce((sum, variation) => sum + variation.price, 0);
							const productTotal = product.quantity * (product.price + extrasTotal);
							return (
								<div className="confirmationItem" key={String(product._id)}>
									<div className="confirmationItemMain"><span>{product.quantity}×</span><strong>{product.name}</strong><b>{formatEuro(productTotal)}</b></div>
									{(product.selectedVariations ?? []).length > 0 && <small>{product.selectedVariations?.map((variation) => variation.name).join(", ")}</small>}
									{product.comment?.trim() && <small>Hinweis: {product.comment.trim()}</small>}
								</div>
							);
						})}
					</div>

					<div className="confirmationTotal"><span>Gesamt</span><strong>{formatEuro(selectionTotal)}</strong></div>
				</div>

				<div className="confirmationActions">
					<Button className="finalOrderButton" label="Jetzt bestellen" loading={placingOrder} onClick={onOrderAction} />
					<button type="button" className="editOrderButton" onClick={() => setConfirmOrder(false)}>Bestellung ändern</button>
					<button type="button" className="continueShoppingButton" onClick={() => { setConfirmOrder(false); props.onContinueShopping?.(); }}>Noch etwas vergessen? Zurück zum Menü</button>
				</div>
			</div>
		);
	}

	return (
		<div className="cartPage">
			{pickupOrder?.approvalMode === "auto" && pickupReadyTime && (
				<div className="cartApproval compactApproval">
					<div className="approvalHeading"><p>Bestellung angenommen</p><p>{pickupOrder.requestedPickupAt ? `Abholung um ${pickupReadyTime} Uhr` : `Voraussichtlich abholbereit um ${pickupReadyTime} Uhr`}</p></div>
				</div>
			)}

			<div className="cartItems">
				{order?.products?.length && approvedProducts ? (
					<Collapsible className="orderedProducts" round label="Bereits bestellt" expand={showOrderHistory} setExpand={setShowOrderHistory} alert={order.products.length}>
						{order.products.map((product, key) => <ItemCard key={key} item={product as unknown as TMenuCustom} staticCard />)}
					</Collapsible>
				) : null}

				{selectedProducts.length > 0 && (
					<>
						<div className="cartSectionHeading"><strong>Deine Auswahl</strong><span>{selectionQuantity} Artikel</span></div>
						<div className="selectedProducts">
							{selectedProducts.map((product, key) => (
								<div className="cartProduct" key={key}>
									<ItemCard item={product} increaseQuantity={increaseProductQuantity} decreaseQuantity={decreaseProductQuantity} />

									{product.ready2orderVariations?.length > 0 && (
										<fieldset className="cartVariationField">
											<legend>Extras & Varianten</legend>
											<p>Mehrfachauswahl möglich.</p>
											<div className="cartVariationList">
												{product.ready2orderVariations.map((variation) => {
													const checked = (product.selectedVariations ?? []).some((item) => item.productId === variation.productId);
													return (
														<label key={variation.productId} className="cartVariationOption">
															<input type="checkbox" checked={checked} onChange={() => toggleVariation(product, variation)} />
															<span>{variation.name}</span>
															<strong>{variation.price ? `+${formatEuro(variation.price)}` : "inkl."}</strong>
														</label>
													);
												})}
											</div>
										</fieldset>
									)}

									<label className="cartOptionField">
										<span>Kommentar / Sonderwunsch</span>
										<textarea
											maxLength={500}
											rows={2}
											placeholder="z. B. ohne Zwiebel, Sauce extra ..."
											value={product.comment ?? ""}
											onChange={(event) => updateProductOptions(String(product._id), { comment: event.target.value })}
										/>
									</label>
								</div>
							))}
						</div>

						{props.pickup && (
							<section className="pickupTimePicker">
								<div className="pickupTimeHeading"><strong>Abholzeit</strong><span>Wähle, wann du deine Bestellung abholen möchtest.</span></div>
								{pickupSlotsLoading ? <p className="pickupTimeStatus">Abholzeiten werden geladen …</p> : null}
								{!pickupSlotsLoading && pickupSlotsMessage ? <p className="pickupTimeStatus pickupTimeError">{pickupSlotsMessage}</p> : null}
								{!pickupSlotsLoading && pickupDays.length > 0 && (
									<>
										<div className="pickupDayList">
											{pickupDays.map((day) => (
												<button key={day.date} type="button" className={day.date === selectedPickupDay?.date ? "active" : ""} onClick={() => { setPickupDay(day.date); if (!day.slots.some((slot) => slot.at === requestedPickupAt)) setRequestedPickupAt(day.slots[0]?.at ?? ""); }}>{day.label}</button>
											))}
										</div>
										<div className="pickupSlotList">
											{selectedPickupDay?.slots.map((slot) => (
												<button key={slot.at} type="button" className={slot.at === requestedPickupAt ? "active" : ""} onClick={() => setRequestedPickupAt(slot.at)}>{slot.label}</button>
											))}
										</div>
									</>
								)}
							</section>
						)}
					</>
				)}
			</div>

			{selectedProducts.length > 0 && (
				<div className="cartCheckout">
					<div className="checkoutSummary"><span>Gesamt</span><strong>{formatEuro(selectionTotal)}</strong></div>
					<Button className="submitOrderButton" label="Weiter" disabled={Boolean(props.pickup && (!requestedPickupAt || pickupSlotsLoading))} onClick={() => setConfirmOrder(true)} />
				</div>
			)}
		</div>
	);
};

export default CartPage;

type TCartPageProps = {
	selectedProducts: Array<TMenuCustom>;
	increaseProductQuantity: (product: TMenuCustom) => void;
	decreaseProductQuantity: (product: TMenuCustom) => void;
	updateProductOptions: (productId: string, options: { comment?: string; selectedVariations?: TSelectedVariation[] }) => void;
	resetSelectedProducts: () => void;
	setSideSheetHeading: (heading: [string, string]) => void;
	tableOverride?: string | null;
	pickup?: boolean;
	onContinueShopping?: () => void;
};

type TMenuCustom = TMenu & {
	quantity: number;
	comment?: string;
	selectedVariations?: TSelectedVariation[];
};
