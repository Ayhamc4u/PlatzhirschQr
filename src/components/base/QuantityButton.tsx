import clsx from "clsx";
import { Icon } from "xtreme-ui";

import "./quantityButton.scss";

const QuantityButton = (props: TQuantityButtonProps) => {
	const { className, disabled, filled, quantity, increaseQuantity, decreaseQuantity } = props;

	const classList = clsx("quantityButton", className, disabled && "disabled", filled && "filled", quantity && "quantityValue");

	return (
		<div className={classList} aria-label="Menge auswählen">
			<div className="hiddenContainer">
				{!disabled && (
					<button className="quantity decrease" type="button" onClick={decreaseQuantity} aria-label="Menge verringern">
						<Icon code="2d" type="solid" />
					</button>
				)}
				<div className="value">
					{disabled && <Icon code="f00d" />}
					<p>{quantity || "0"}</p>
				</div>
			</div>
			{!disabled && (
				<button className="quantity increase" type="button" onClick={increaseQuantity} aria-label="Menge erhöhen">
					<Icon code="2b" type="solid" style={{ fontSize: 16 }} />
				</button>
			)}
		</div>
	);
};

export default QuantityButton;

type TQuantityButtonProps = {
	className?: string;
	disabled?: boolean;
	filled?: boolean;
	quantity: number;
	increaseQuantity: () => void;
	decreaseQuantity: () => void;
};
