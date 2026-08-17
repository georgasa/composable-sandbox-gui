import { useState } from "react";
import { PhoneFrame } from "../components/mobile/PhoneFrame";
import { MobileThemeProvider } from "../context/MobileThemeContext";
import { MobileSessionProvider, useMobileSession } from "../context/MobileSessionContext";
import { LoginScreen } from "../components/mobile/screens/LoginScreen";
import { DashboardScreen } from "../components/mobile/screens/DashboardScreen";
import { TransactionsScreen } from "../components/mobile/screens/TransactionsScreen";
import { TransferScreen } from "../components/mobile/screens/TransferScreen";
import { LoansScreen } from "../components/mobile/screens/LoansScreen";
import { LoanScheduleScreen } from "../components/mobile/screens/LoanScheduleScreen";
import { ProfileScreen } from "../components/mobile/screens/ProfileScreen";
import { SettingsScreen } from "../components/mobile/screens/SettingsScreen";

type Tab = "home" | "transfer" | "loans" | "profile";
type Screen = Tab | "transactions" | "loan-schedule" | "settings";

/** The Mobile tab -- a phone-frame demo UI driven by the SAME party session
 * (PartyContext, mounted in main.tsx) the Catalog/Assistant/Flows tabs use.
 * No separate auth/login of its own: the app-wide AuthGate (App.tsx)
 * already covers this tab, and "reusing an existing party" is just typing
 * an ID into the party bar above (PartySessionBar) -- MobileSessionContext
 * reacts to activePartyId changing from any tab. */
export function MobileSimulator() {
  return (
    <MobileThemeProvider>
      <MobileSessionProvider>
        <Shell />
      </MobileSessionProvider>
    </MobileThemeProvider>
  );
}

function Shell() {
  const { partyId } = useMobileSession();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [settingsOpenedFrom, setSettingsOpenedFrom] = useState<Tab>("home");

  const tab: Tab =
    screen === "transactions" ? "home" : screen === "loan-schedule" ? "loans" : screen === "settings" ? settingsOpenedFrom : screen;

  const navigate = (t: Tab) => setScreen(t);

  const openSettings = () => {
    setSettingsOpenedFrom(tab);
    setScreen("settings");
  };

  return (
    <div className="mobile-tab-content">
      <div className="mobile-page-wrap">
        <PhoneFrame activeTab={tab} onNavigate={navigate} onOpenSettings={openSettings}>
          {!partyId ? (
            screen === "settings" ? (
              <SettingsScreen onClose={() => setScreen("home")} />
            ) : (
              <LoginScreen />
            )
          ) : (
            <>
              {screen === "home" && (
                <DashboardScreen
                  onSelectAccount={(id) => {
                    setSelectedAccountId(id);
                    setScreen("transactions");
                  }}
                />
              )}
              {screen === "transactions" && selectedAccountId && (
                <TransactionsScreen accountId={selectedAccountId} onBack={() => setScreen("home")} />
              )}
              {screen === "transfer" && <TransferScreen />}
              {screen === "loans" && (
                <LoansScreen
                  onSelectLoan={(id) => {
                    setSelectedLoanId(id);
                    setScreen("loan-schedule");
                  }}
                />
              )}
              {screen === "loan-schedule" && selectedLoanId && (
                <LoanScheduleScreen loanId={selectedLoanId} onBack={() => setScreen("loans")} />
              )}
              {screen === "profile" && <ProfileScreen />}
              {screen === "settings" && <SettingsScreen onClose={() => setScreen(settingsOpenedFrom)} />}
            </>
          )}
        </PhoneFrame>
      </div>
    </div>
  );
}
