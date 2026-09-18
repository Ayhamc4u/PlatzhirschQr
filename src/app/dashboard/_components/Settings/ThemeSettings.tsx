"use client";

import { useTheme } from "#components/context/Theme";

import "./themeSettings.scss";

const lightColors = [
	["Seitenhintergrund", "#F4F0E8"],
	["Karten / Panels", "#FFFDF8"],
	["Erhöhte Flächen", "#F0EBE1"],
	["Primärtext", "#171511"],
	["Sekundärtext", "#6E675D"],
	["Dezenter Text", "#8E867A"],
	["Rahmen", "#D8D0C3"],
	["Starker Rahmen", "#BEB4A5"],
	["Gold", "#D9A441"],
	["Gold Hover", "#C89336"],
	["Gold Active", "#B9842C"],
	["Fehler", "#B33A32"],
	["Erfolg", "#4F7A52"],
	["Info", "#3F6F8F"],
] as const;

const darkColors = [
	["Seitenhintergrund", "#11100E"],
	["Karten / Panels", "#1B1A17"],
	["Erhöhte Flächen", "#24221E"],
	["Primärtext", "#F4F0E8"],
	["Sekundärtext", "#B9B2A7"],
	["Dezenter Text", "#8D877F"],
	["Rahmen", "#37332D"],
	["Starker Rahmen", "#4B463E"],
	["Gold", "#D9A441"],
	["Gold Hover", "#E2AF4D"],
	["Gold Active", "#C89336"],
	["Fehler", "#E06B62"],
	["Erfolg", "#79A77C"],
	["Info", "#6EA0C0"],
] as const;

const ThemeSettings = () => {
	const { theme, setTheme } = useTheme();

	return (
		<div className="themeSettings">
			<section className="designIntro">
				<div>
					<p className="eyebrow">Platzhirsch Design</p>
					<h1>Hell & Dunkel</h1>
					<p className="description">
						Die Oberfläche verwendet zwei feste Farbschemata. Glutgold bleibt in beiden Modi der gemeinsame Markenakzent.
					</p>
				</div>
				<div className="modeSwitch" role="group" aria-label="Farbschema">
					<button type="button" className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Hell</button>
					<button type="button" className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dunkel</button>
				</div>
			</section>

			<div className="brandColors">
				<div className="brandColor">
					<span className="swatch" style={{ background: "#11100E" }} />
					<div><strong>Platzhirsch Schwarz</strong><code>#11100E</code></div>
				</div>
				<div className="brandColor">
					<span className="swatch" style={{ background: "#F4F0E8" }} />
					<div><strong>Warmweiß</strong><code>#F4F0E8</code></div>
				</div>
				<div className="brandColor">
					<span className="swatch" style={{ background: "#D9A441" }} />
					<div><strong>Glutgold</strong><code>#D9A441</code></div>
				</div>
			</div>

			<div className="paletteGrid">
				<Palette title="Light Mode" colors={lightColors} />
				<Palette title="Dark Mode" colors={darkColors} />
			</div>
		</div>
	);
};

const Palette = ({ title, colors }: { title: string; colors: readonly (readonly [string, string])[] }) => (
	<section className="paletteCard">
		<h2>{title}</h2>
		<div className="paletteList">
			{colors.map(([label, color]) => (
				<div className="paletteRow" key={`${title}-${label}`}>
					<span className="swatch" style={{ background: color }} />
					<span className="label">{label}</span>
					<code>{color}</code>
				</div>
			))}
		</div>
	</section>
);

export default ThemeSettings;
