import { capitalize } from "xtreme-ui";

import { DashboardProvider } from "#components/context";
import NavSideBar from "#components/layout/NavSideBar";

import PageContainer from "./_components/PageContainer";
import "./dashboard.scss";

const navItems = [
	{ label: "Orders", icon: "e43b", value: "orders" },
	{ label: "Tische", icon: "f0ce", value: "tables" },
	{ label: "Menü", icon: "f03a", value: "menu" },
	{ label: "Geschäftszeiten", icon: "f017", value: "hours" },
	{ label: "Design", icon: "f53f", value: "design" },
	{ label: "Profil", icon: "f007", value: "profile" },
	{ label: "Logout", icon: "f011", value: "signout" },
];

export async function generateMetadata({ searchParams }: IMetaDataProps) {
	const s = await searchParams;
	return {
		title: `OrderWorder${s.tab ? ` • ${capitalize(s.tab)}` : ""}`,
	};
}

const Dashboard = () => {
	return (
		<DashboardProvider>
			<div className="dashboard">
				<NavSideBar navItems={navItems} defaultTab="orders" foot />
				<PageContainer />
			</div>
		</DashboardProvider>
	);
};

export default Dashboard;

interface IMetaDataProps {
	params: {
		restaurant: string;
	};
	searchParams: {
		tab?: string;
		[key: string]: string | undefined;
	};
}
