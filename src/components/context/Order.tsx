import noop from "lodash/noop";
import pick from "lodash/pick";
import { useSession } from "next-auth/react";
import { createContext, type ReactNode, useEffect, useState } from "react";
import { toast } from "react-toastify";
import useSWR from "swr";

import type { TMenu, TOrderType } from "#utils/database/models/menu";
import type { TOrder, TSelectedVariation } from "#utils/database/models/order";
import { fetcher } from "#utils/helper/common";

const OrderDefault: TOrderInitialType = {
	order: undefined,
	loading: false,
	placeOrder: () => Promise.resolve(false),
	placingOrder: false,
	cancelOrder: noop,
	cancelingOrder: false,
	loginOpen: false,
	setLoginOpen: noop,
};

export const OrderContext = createContext(OrderDefault);
export const OrderProvider = ({ children }: TOrderProviderProps) => {
	const session = useSession();
	const authenticated = session.status === "authenticated";
	const { data: order, isLoading: loading, mutate } = useSWR(authenticated ? "/api/order" : null, fetcher, { refreshInterval: 5000 });

	const [placingOrder, setPlacingOrder] = useState(false);
	const [cancelingOrder, setCancelingOrder] = useState(false);
	const [loginOpen, setLoginOpen] = useState(false);

	const placeOrder = async (products: Array<TMenuCustom>, context?: TPlaceOrderContext) => {
		setPlacingOrder(true);
		try {
			const req = await fetch("/api/order/place", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					products: products.map((product) => pick(product, ["_id", "quantity", "comment", "selectedVariations"])),
					orderType: context?.orderType,
					table: context?.table,
					requestedPickupAt: context?.requestedPickupAt,
				}),
			});
			const res = await req.json();

			if (!req.ok) {
				toast.error(res?.message);
				return false;
			}
			await mutate();
			return true;
		} finally {
			setPlacingOrder(false);
		}
	};
	const cancelOrder = async () => {
		setCancelingOrder(true);
		const req = await fetch("/api/order/cancel", { method: "POST" });
		const res = await req.json();

		if (!req.ok) toast.error(res?.message);
		await mutate();
		setCancelingOrder(false);
	};

	useEffect(() => {
		mutate();
	}, [mutate]);

	return (
		<OrderContext.Provider value={{ order, loading, placeOrder, placingOrder, cancelOrder, cancelingOrder, loginOpen, setLoginOpen }}>
			{children}
		</OrderContext.Provider>
	);
};

export type TOrderProviderProps = {
	children?: ReactNode;
};

type TPlaceOrderContext = {
	orderType: Extract<TOrderType, "DINE_IN" | "PICKUP">;
	table?: string | null;
	requestedPickupAt?: string;
};

export type TOrderInitialType = {
	order?: TOrder;
	loading: boolean;
	placeOrder: (products: Array<TMenuCustom>, context?: TPlaceOrderContext) => Promise<boolean>;
	placingOrder: boolean;
	cancelOrder: () => void;
	cancelingOrder: boolean;
	loginOpen: boolean;
	setLoginOpen: (open: boolean) => void;
};
type TMenuCustom = TMenu & {
	quantity: number;
	comment?: string;
	selectedVariations?: TSelectedVariation[];
};
