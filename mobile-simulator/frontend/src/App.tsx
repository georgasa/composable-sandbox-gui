import { useState } from "react";
import { AuthGate } from "./components/AuthGate";
import { PhoneFrame } from "./components/PhoneFrame";
import { ThemeProvider } from "./context/ThemeContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import { LoginScreen } from "./components/screens/LoginScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { TransactionsScreen } from "./components/screens/TransactionsScreen";
import { TransferScreen } from "./components/screens/TransferScreen";
import { LoansScreen } from "./components/screens/LoansScreen";
import { LoanScheduleScreen } from "./components/screens/LoanScheduleScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";

type Tab = "home" | "transfer" | "loans" | "profile";
type Screen = Tab | "transactions" | "loan-schedule" | "settings";

export function App() {
  return (
    <ThemeProvider>
      <AuthGate>
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </AuthGate>
    </ThemeProvider>
  );
}

function Shell() {
  const { partyId } = useSession();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [settingsOpenedFrom, setSettingsOpenedFrom] = useState<Tab>("home");

  const tab: Tab = screen === "transactions" ? "home" : screen === "loan-schedule" ? "loans" : screen === "settings" ? settingsOpenedFrom : screen;

  const navigate = (t: Tab) => setScreen(t);

  const openSettings = () => {
    setSettingsOpenedFrom(tab);
    setScreen("settings");
  };

  if (!partyId) {
    return (
      <div className="page-wrap">
        <PhoneFrame activeTab="home" onNavigate={() => {}} onOpenSettings={openSettings}>
          {screen === "settings" ? <SettingsScreen onClose={() => setScreen("home")} /> : <LoginScreen />}
        </PhoneFrame>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PhoneFrame activeTab={tab} onNavigate={navigate} onOpenSettings={openSettings}>
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
      </PhoneFrame>
    </div>
  );
}
