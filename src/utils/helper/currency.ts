const euroFormatter = new Intl.NumberFormat("de-AT", {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const formatEuro = (value: number | null | undefined) => euroFormatter.format(value ?? 0);
