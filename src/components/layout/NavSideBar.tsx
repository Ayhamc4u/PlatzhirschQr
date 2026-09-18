"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { Icon } from "xtreme-ui";

import { useQueryParams } from "#utils/hooks/useQueryParams";

import "./navSideBar.scss";

const NavSideBar = (props: TNavSideBar) => {
	const { head, foot, navItems, defaultTab } = props;
	const router = useRouter();
	const session = useSession();
	const queryParams = useQueryParams();
	const tab = queryParams.get("tab") ?? "";

	const classList = clsx("menu", head && "head", foot && "foot");

	const onNavClick = (nextTab: string) => {
		if (nextTab === "signout") return router.push("/logout");
		queryParams.set({ tab: nextTab });
	};

	useEffect(() => {
		if (!tab) queryParams.set({ tab: defaultTab });
	}, [defaultTab, queryParams, tab]);

	return (
		<div className="navSideBar">
			<div className={classList}>
				{navItems.map((item) => {
					if (item.value === "signout" && session.status !== "authenticated") return null;

					const active = tab === item.value;
					return (
						<button
							key={item.value}
							type="button"
							className={clsx("navItem", active && "active")}
							onClick={() => onNavClick(item.value)}
						>
							<span className="navItemContent">
								<Icon code={item.icon} style={{ fontSize: 20 }} set={active ? "classic" : "duotone"} type="solid" />
								<span className="navLabel">{item.label}</span>
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default NavSideBar;

type TNavSideBar = {
	navItems: Array<{ label: string; value: string; icon: string }>;
	defaultTab: string;
	head?: boolean;
	foot?: boolean;
};
