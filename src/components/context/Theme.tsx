"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import "./theme.scss";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
	theme: ThemeMode;
	setTheme: (theme: ThemeMode) => void;
};

const STORAGE_KEY = "platzhirsch-theme";
const DEFAULT_THEME: ThemeMode = "dark";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (theme: ThemeMode) => {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
};

export const ThemeProvider = ({ children }: { children?: ReactNode }) => {
	const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME);

	useEffect(() => {
		const storedTheme = window.localStorage.getItem(STORAGE_KEY);
		const initialTheme: ThemeMode = storedTheme === "light" || storedTheme === "dark" ? storedTheme : DEFAULT_THEME;
		setThemeState(initialTheme);
		applyTheme(initialTheme);
	}, []);

	const setTheme = (nextTheme: ThemeMode) => {
		setThemeState(nextTheme);
		window.localStorage.setItem(STORAGE_KEY, nextTheme);
		applyTheme(nextTheme);
	};

	const value = useMemo(() => ({ theme, setTheme }), [theme]);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export const ThemeSwitcher = ({ className = "" }: { className?: string }) => {
	const { theme, setTheme } = useTheme();
	const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
	const label = nextTheme === "light" ? "Helles Farbschema aktivieren" : "Dunkles Farbschema aktivieren";

	return (
		<button
			type="button"
			className={`themeSwitcher ${className}`.trim()}
			onClick={() => setTheme(nextTheme)}
			aria-label={label}
			title={label}>
			{theme === "dark" ? (
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
				</svg>
			) : (
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
				</svg>
			)}
		</button>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used inside ThemeProvider");
	return context;
};
