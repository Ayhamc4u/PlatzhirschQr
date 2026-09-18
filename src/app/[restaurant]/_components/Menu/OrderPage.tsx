import { useSession } from "next-auth/react";
import { type UIEvent, useEffect, useMemo, useState } from "react";
import { Button, Spinner } from "xtreme-ui";

import SearchButton from "#components/base/SearchButton";
import SideSheet from "#components/base/SideSheet";
import { useOrder, useRestaurant } from "#components/context/useContext";
import { ThemeSwitcher } from "#components/context/Theme";
import Modal from "#components/layout/Modal";
import type { TMenu } from "#utils/database/models/menu";
import type { TSelectedVariation } from "#utils/database/models/order";
import { formatEuro } from "#utils/helper/currency";
import { useQueryParams } from "#utils/hooks/useQueryParams";

import CartPage from "./CartPage";
import MenuCard from "./MenuCard";
import UserLogin from "./UserLogin";
import "./orderPage.scss";

const DEFAULT_CATEGORY = "burger";
const ABHOFVERKAUF_CATEGORIES = new Set(["oel", "most", "wein"]);
const LEGACY_PICKUP_CATEGORIES = new Set(["burger", "pizza", "snacks", "salate", "nachspeisen", "oel", "most", "wein"]);
const MENU_CATEGORIES = [{ id: "fruehstueck", label: "Frühstück" }, { id: "burger", label: "Burger" }, { id: "pizza", label: "Pizza" }, { id: "snacks", label: "Snacks" }, { id: "salate", label: "Salate" }, { id: "nachspeisen", label: "Nachspeisen" }, { id: "alkoholfreie-getraenke", label: "Alkoholfreie Getränke" }, { id: "kaffee-und-tee", label: "Kaffee & Tee" }, { id: "biere", label: "Biere" }, { id: "spritzer", label: "Spritzer" }, { id: "longdrinks", label: "Longdrinks" }, { id: "spirituosen", label: "Spirituosen" }, { id: "flaschen", label: "Flaschen" }, { id: "weine", label: "Weine" }, { id: "sekt-champagner", label: "Sekt & Champagner" }, { id: "gutscheine", label: "Gutscheine" }] as const;
const PICKUP_CATEGORIES = [{ id: "burger", label: "Burger" }, { id: "pizza", label: "Pizza" }, { id: "snacks", label: "Snacks" }, { id: "salate", label: "Salate" }, { id: "nachspeisen", label: "Nachspeisen" }, { id: "abhofverkauf", label: "Abhofverkauf" }] as const;

const isAvailableForFlow = (menuItem: TMenuCustom, pickup: boolean) => {
	if (Array.isArray(menuItem.availableOrderTypes)) return menuItem.availableOrderTypes.includes(pickup ? "PICKUP" : "DINE_IN");
	return pickup ? LEGACY_PICKUP_CATEGORIES.has(menuItem.category) : true;
};

const OrderPage = () => {
	const session = useSession();
	const { loading, loginOpen, setLoginOpen } = useOrder();
	const { restaurant } = useRestaurant();
	const menus = restaurant?.menus as Array<TMenuCustom>;
	const params = useQueryParams();
	const table = params.get("table");
	const pickup = params.get("pickup") === "1";
	const requestedPickupTable = params.get("pickupTable");
	const scannedTable = restaurant?.tables?.find(({ username, qrToken }) => username === table || qrToken === table);
	const pickupTables = restaurant?.tables?.filter(({ name }) => /^abh\s*\d+/i.test(name?.trim?.() ?? "")) ?? [];
	const pickupTable = pickupTables.find(({ username }) => username === requestedPickupTable) ?? pickupTables[0];
	const effectiveTable = pickup ? pickupTable?.username ?? null : scannedTable?.username ?? null;
	const tableDisplayName = !pickup && scannedTable?.name?.trim?.() ? scannedTable.name.trim() : null;
	const searchParam = params.get("search")?.trim() ?? "";
	const categoryParam = params.get("category")?.trim() ?? "";
	const availableCategories = pickup ? PICKUP_CATEGORIES : MENU_CATEGORIES;
	const category = availableCategories.some(({ id }) => id === categoryParam) ? categoryParam : DEFAULT_CATEGORY;
	const [sideSheetOpen, setSideSheetOpen] = useState(false);
	const [orderHeading, setOrderHeading] = useState([pickup ? "Online" : "Unser", pickup ? "Abholung" : "Menü"]);
	const [sideSheetHeading, setSideSheetHeading] = useState<[string, string]>(["Deine", "Bestellung"]);
	const [searchActive, setSearchActive] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [floatHeader, setFloatHeader] = useState(false);
	const [selectedProducts, setSelectedProducts] = useState<Array<TMenuCustom>>([]);

	const filteredProducts = useMemo(() => {
		const search = searchParam.toLowerCase();
		return menus?.filter?.((item) => {
			if (item.hidden || !isAvailableForFlow(item, pickup)) return false;
			const matchesSearch = search ? item.name?.toLowerCase().includes(search) || item.description?.toLowerCase().includes(search) || item.category?.toLowerCase().includes(search) : false;
			if (search) return matchesSearch;
			return pickup && category === "abhofverkauf" ? ABHOFVERKAUF_CATEGORIES.has(item.category) : item.category === category;
		}) ?? [];
	}, [category, menus, pickup, searchParam]);

	const visibleProducts = filteredProducts;
	const hasImageItems = visibleProducts.some((product) => !!product.image);
	const hasNonImageItems = visibleProducts.some((product) => !product.image);
	const hasValidOrderContext = !!effectiveTable && restaurant?.tables?.some(({ username }) => username === effectiveTable);
	const isCustomer = session.data?.role === "customer";
	const hasCustomerAccount = isCustomer && Boolean(session.data?.customer?.accountEnabled);
	const selectedQuantity = selectedProducts.reduce((total, product) => total + product.quantity, 0);
	const selectedTotal = selectedProducts.reduce((total, product) => total + product.quantity * (product.price + (product.selectedVariations ?? []).reduce((sum, variation) => sum + variation.price, 0)), 0);
	const showMobileCart = hasValidOrderContext && selectedProducts.length > 0;
	const onMenuScroll = (event: UIEvent<HTMLDivElement>) => setFloatHeader((event.target as HTMLDivElement).scrollTop > 30);
	const onCategoryClick = (categoryName: string) => params.set({ category: categoryName });
	const clearFilters = () => { setSearchValue(""); params.set({ category: DEFAULT_CATEGORY, search: "" }); };
	const onLoginClick = () => { if (effectiveTable) return setLoginOpen(true); params.router.push("/scan"); };
	const openCart = () => { if (!isCustomer) return onLoginClick(); setSideSheetOpen(true); };
	const continueAfterLogin = () => {
		setSideSheetHeading(["Deine", "Bestellung"]);
		setSideSheetOpen(true);
	};
	const increaseProductQuantity = (product: TMenuCustom) => setSelectedProducts((current) => { const existing = current.find((item) => item._id === product._id); if (existing) return current.map((item) => item._id === product._id ? ({ ...item, quantity: item.quantity + 1 } as unknown as TMenuCustom) : item); return [...current, { ...product, quantity: 1, comment: "", selectedVariations: [] } as unknown as TMenuCustom]; });
	const decreaseProductQuantity = (product: TMenuCustom) => setSelectedProducts((current) => current.map((item) => item._id === product._id ? ({ ...item, quantity: item.quantity - 1 } as unknown as TMenuCustom) : item).filter((item) => item.quantity > 0));
	const updateProductOptions = (productId: string, options: { comment?: string; selectedVariations?: TSelectedVariation[] }) => setSelectedProducts((current) => current.map((item) => String(item._id) === productId ? ({ ...item, ...options } as unknown as TMenuCustom) : item));

	useEffect(() => { if (categoryParam && !availableCategories.some(({ id }) => id === categoryParam)) params.set({ category: DEFAULT_CATEGORY }); }, [availableCategories, categoryParam, params]);
	useEffect(() => { params.set({ search: searchValue }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [searchValue, params.set]);
	useEffect(() => { setOrderHeading(pickup ? ["Online", "Abholung"] : ["Unser", "Menü"]); }, [pickup]);
	const renderMenuCard = (item: TMenuCustom, key: number, show: boolean) => <MenuCard key={key} item={item} restrictOrder={!hasValidOrderContext} increaseQuantity={increaseProductQuantity} decreaseQuantity={decreaseProductQuantity} show={show} quantity={selectedProducts.find((obj) => obj._id === item._id)?.quantity || 0} />;

	return <div className={`orderPage ${showMobileCart ? "hasMobileCart" : ""}`}>
		<div className="mainContainer" onScroll={onMenuScroll}>
			<div className={`mainHeader ${searchActive ? "searchActive" : ""} ${floatHeader ? "floatHeader" : ""}`}>
				<button className="homeButton" type="button" onClick={() => params.router.push("/")} aria-label="Zur Startseite"><span aria-hidden="true">←</span><strong>Startseite</strong></button>
				{tableDisplayName && hasValidOrderContext && <div className="tableContext" aria-label={`Aktueller Tisch: ${tableDisplayName}`}><span className="tableContextLabel">Dein Tisch</span><strong>{tableDisplayName}</strong></div>}
				<div className="options">
					<SearchButton setSearchActive={setSearchActive} placeholder="Menü durchsuchen" value={searchValue} setValue={setSearchValue} />
					<ThemeSwitcher />
					{hasCustomerAccount ? (
						<button className="accountButton" type="button" onClick={() => params.router.push(`/${restaurant?.username || "platzhirsch"}/account`)}>Mein Konto</button>
					) : !isCustomer ? (
						<button className="accountButton" type="button" onClick={() => params.router.push(`/${restaurant?.username || "platzhirsch"}/account/login`)}>Anmelden</button>
					) : null}
					{(!isCustomer || !hasValidOrderContext) && <Button className="loginButton" label={hasValidOrderContext ? (pickup ? "Abholung starten" : "Bestellen") : "QR scannen"} onClick={onLoginClick} />}
					{hasValidOrderContext && selectedProducts.length > 0 && <button className="desktopCartCta" type="button" onClick={openCart}><span><small>{selectedQuantity} Artikel</small><strong>Warenkorb ansehen</strong></span><b>{formatEuro(selectedTotal)}</b></button>}
					{session.data?.role === "admin" && <Button className="dashboardButton" label="Dashboard" icon="e09f" iconType="solid" onClick={() => params.router.push("/dashboard")} />}
					{session.data?.role === "kitchen" && <Button className="kitchenButton" label="Kitchen" icon="e09f" iconType="solid" onClick={() => params.router.push("/kitchen")} />}
				</div>
			</div>
			{restaurant && <section className="category" aria-label="Menükategorien"><div className="itemCategories">{availableCategories.map((item) => <button key={item.id} type="button" className={`menuCategory ${category === item.id ? "active" : ""}`} aria-pressed={category === item.id} onClick={() => onCategoryClick(item.id)}><span className="title">{item.label}</span></button>)}</div></section>}
			{!restaurant ? <Spinner label="Menü wird geladen..." fullpage /> : <div className="order"><div className="header"><h1>{searchParam ? "Suchergebnisse" : orderHeading[0]} {!searchParam && <span>{orderHeading[1]}</span>}</h1></div>{visibleProducts.length === 0 && <div className="menuEmptyState"><strong>Keine Speisen gefunden</strong><span>{searchParam ? "Für diese Suche gibt es in diesem Bestellangebot keine Treffer." : "Versuche eine andere Kategorie."}</span>{searchParam && <button type="button" onClick={clearFilters}>Burger anzeigen</button>}</div>}{hasImageItems && <div className="itemContainer"><div>{visibleProducts.map((item, key) => renderMenuCard(item, key, !!item.image))}</div></div>}{hasImageItems && hasNonImageItems && <hr />}{hasNonImageItems && <div className="itemContainer withoutImage"><div>{visibleProducts.map((item, key) => renderMenuCard(item, key, !item.image))}</div></div>}</div>}
			<footer className="menuFooter"><div><strong>Platzhirsch Zwettl</strong><span>Marktplatz 8 · 4180 Zwettl an der Rodl</span></div><div><a href="tel:+436604583402">+43 660 4583 402</a><a href="mailto:office@platzhirschzwettl.at">office@platzhirschzwettl.at</a></div><div><span>Mo–Sa 09:00–13:00</span><span>Mi–Sa 17:00–24:00</span></div><div className="footerLinks"><a href="https://www.platzhirschzwettl.at/" target="_blank" rel="noreferrer">Webseite</a><a href="https://www.platzhirschzwettl.at/reservierungen/" target="_blank" rel="noreferrer">Tisch reservieren</a></div></footer>
		</div>
		{showMobileCart && <button className="mobileCartBar" type="button" onClick={openCart} aria-label="Bestellung prüfen und Warenkorb öffnen"><span className="mobileCartBadge">{selectedQuantity}</span><span className="mobileCartCopy"><small>Artikel im Warenkorb</small><strong>Bestellung prüfen</strong></span><b>{formatEuro(selectedTotal)} <span aria-hidden="true">→</span></b></button>}
		<style jsx global>{`.orderPage .menuCategory.active { background: #d9a441 !important; border-color: #d9a441 !important; color: #11100e !important; } .orderPage .menuCategory.active .title { color: #11100e !important; } .orderPage .mainHeader:has(.tableContext) { grid-template-columns: auto auto minmax(0, 1fr); } .orderPage .mainHeader .tableContext { display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:7px 12px;border:1px solid color-mix(in srgb,#d9a441 35%,transparent);border-radius:8px;background:color-mix(in srgb,#d9a441 10%,var(--colorBackgroundPrimary));color:var(--colorContentPrimary);white-space:nowrap;} .orderPage .mainHeader .tableContextLabel{color:var(--colorContentSecondary);font-size:11px;font-weight:600}.orderPage .mainHeader .tableContext strong{color:#d9a441;font-size:14px;font-variation-settings:'wdth' 78,'wght' 750}@media(max-width:1100px){.orderPage .mainHeader:has(.tableContext){grid-template-columns:auto minmax(0,1fr)}.orderPage .mainHeader .tableContext{grid-column:1/-1;grid-row:2;justify-self:start}}@media(max-width:750px){.orderPage .mainHeader .tableContext{width:100%;min-height:34px;justify-content:center;padding:5px 10px}}`}</style>
		<SideSheet title={sideSheetHeading} open={sideSheetOpen} setOpen={setSideSheetOpen}>{loading ? <Spinner label="Bestellung wird geladen..." fullpage /> : <CartPage selectedProducts={selectedProducts} increaseProductQuantity={increaseProductQuantity} decreaseProductQuantity={decreaseProductQuantity} updateProductOptions={updateProductOptions} resetSelectedProducts={() => setSelectedProducts([])} setSideSheetHeading={setSideSheetHeading} tableOverride={effectiveTable} pickup={pickup} onContinueShopping={() => setSideSheetOpen(false)} />}</SideSheet>
		<Modal open={loginOpen} setOpen={setLoginOpen}><UserLogin setOpen={setLoginOpen} tableOverride={effectiveTable} pickup={pickup} onSuccess={continueAfterLogin} /></Modal>
	</div>;
};
export default OrderPage;
type TMenuCustom = TMenu & { quantity: number; comment?: string; selectedVariations?: TSelectedVariation[] };
