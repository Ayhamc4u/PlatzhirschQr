import clsx from "clsx";
import { useInView } from "react-intersection-observer";

import QuantityButton from "#components/base/QuantityButton";
import type { TMenu } from "#utils/database/models/menu";
import { formatEuro } from "#utils/helper/currency";

import "./menuCard.scss";

const MenuCard = (props: TMenuCardProps) => {
	const { className, show, restrictOrder, item, quantity } = props;
	const [cardRef, inView] = useInView({ triggerOnce: true, threshold: 0 });
	const variations = item.ready2orderVariations ?? [];

	if (!show) return null;

	return (
		<article
			id={`menu-item-${item._id}`}
			className={clsx("menuCard", className, restrictOrder && "restrictOrder", !item.image && "withoutImage", !inView && "blank")}
			ref={cardRef}>
			{inView && (
				<>
					{item.image && (
						<div className="picture" aria-hidden="true">
							<span style={{ backgroundImage: `url(${item.image})` }} />
						</div>
					)}

					<div className="content">
						<div className="copy">
							<h2>{item.name}</h2>
							{item.description && <p>{item.description}</p>}
							{variations.length > 0 && (
								<details className="variationInfo">
									<summary><span aria-hidden="true">ⓘ</span> Extras & Varianten verfügbar</summary>
									<div className="variationPreview">
										{variations.slice(0, 5).map((variation) => (
											<span key={variation.productId}>
												{variation.name}{variation.price ? ` (+${formatEuro(variation.price)})` : ""}
											</span>
										))}
										{variations.length > 5 && <span>+ {variations.length - 5} weitere</span>}
										<small>Auswahl im Warenkorb möglich – auch mehrere Extras gleichzeitig.</small>
									</div>
								</details>
							)}
						</div>

						<div className="footer">
							<strong className="menuPrice">{formatEuro(item.price)}</strong>
							<QuantityButton
								className="addToCart"
								quantity={quantity}
								filled
								disabled={restrictOrder}
								increaseQuantity={() => props.increaseQuantity(item)}
								decreaseQuantity={() => props.decreaseQuantity(item)}
							/>
						</div>
					</div>
				</>
			)}
		</article>
	);
};

export default MenuCard;

type TMenuCardProps = {
	className?: string;
	show?: boolean;
	restrictOrder?: boolean;
	item: TMenuCustom;
	quantity: number;
	increaseQuantity: (item: TMenuCustom) => void;
	decreaseQuantity: (item: TMenuCustom) => void;
};

type TMenuCustom = TMenu & { quantity: number };
