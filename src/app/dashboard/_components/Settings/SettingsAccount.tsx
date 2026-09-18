import { useSession } from "next-auth/react";
import { Spinner } from "xtreme-ui";

import { useAdmin } from "#components/context/useContext";

import PasswordSettings from "./PasswordSettings";
import "./settingsAccount.scss";

const SettingsAccount = () => {
	const { profile } = useAdmin();
	const session = useSession();

	if (session.status === "loading" || !profile) return <Spinner fullpage label="Loading Profile..." />;

	return (
		<div className="settingsAccount">
			<PasswordSettings />
		</div>
	);
};

export default SettingsAccount;
