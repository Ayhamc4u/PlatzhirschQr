import clsx from "clsx";
import { useInView } from "react-intersection-observer";

import QuantityButton from "#components/base/QuantityButton";
import type { TMenu } from "#utils/database/models/menu";
import type { TSelectedVariation } from "#utils/database/models/order";
import { formatEuro } from "#utils/helper/currency";

import "./itemCard.scss";

const ItemCard = (props: TItemCardProps) => {
	const { className, item, staticCard, increaseQuantity, decreaseQuantity } = props;
	const [cardRef, inView] = useInView({ triggerOnce: true, threshold: 0 });
	const extrasPrice = (item.selectedVariations ?? []).reduce((sum, variation) => sum + variation.price, 0);
	const unitPrice = staticCard ? item.price : item.price + extrasPrice;
	const totalPrice = item.quantity ? unitPrice * item.quantity : unitPrice;
	const hasMeta = !!item.selectedVariations?.length || !!item.comment;
	const classList = clsx("itemCard", className, staticCard && "staticCard", hasMeta && "hasMeta");

	return (
		<div className={classList} ref={cardRef}>
			{inView && (
				<>
					{item.image && (
						<div className="picture">
							<span style={{ background: `url(${item.image})` }} />
						</div>
					)}
					<div className="options">
						<p className="title">{item.name}</p>
						{!!item.selectedVariations?.length && <p className="itemMeta">Extras: {item.selectedVariations.map((variation) => variation.name).join(", ")}</p>}
						{item.comment && <p className="itemMeta">Hinweis: {item.comment}</p>}
						<div className="footer">
							<div className="price">
								{!staticCard && <p>{formatEuro(totalPrice)}</p>}
								{staticCard && <p>{formatEuro(item.price)} <span>✕</span> {item.quantity}</p>}
							</div>
							{staticCard ? (
								<div className="totalAmount">{formatEuro(totalPrice)}</div>
							) : (
								<QuantityButton
									className="addToCart"
									quantity={item.quantity}
									increaseQuantity={() => increaseQuantity?.(item)}
									decreaseQuantity={() => decreaseQuantity?.(item)}
								/>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
};

export default ItemCard;

type TItemCardProps = {
	className?: string;
	item: TMenuCustom;
	staticCard?: boolean;
	increaseQuantity?: (item: TMenuCustom) => void;
	decreaseQuantity?: (item: TMenuCustom) => void;
};

type TMenuCustom = TMenu & {
	quantity: number;
	comment?: string;
	selectedVariations?: TSelectedVariation[];
};
