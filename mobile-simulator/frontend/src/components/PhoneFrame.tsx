import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  activeTab: "home" | "transfer" | "loans" | "profile";
  onNavigate: (tab: "home" | "transfer" | "loans" | "profile") => void;
  onOpenSettings: () => void;
}

export function PhoneFrame({ children, activeTab, onNavigate, onOpenSettings }: Props) {
  return (
    <div className="phone-shell">
      <div className="phone">
        <div className="phone-statusbar">
          <span>9:41</span>
          <div className="phone-statusbar-icons">
            <button className="icon-btn" onClick={onOpenSettings} title="Settings">
              ⚙
            </button>
          </div>
        </div>
        <div className="phone-screen">{children}</div>
        <div className="phone-navbar">
          <button className={`nav-btn${activeTab === "home" ? " active" : ""}`} onClick={() => onNavigate("home")}>
            <span className="nav-icon">🏠</span>
            Home
          </button>
          <button className={`nav-btn${activeTab === "transfer" ? " active" : ""}`} onClick={() => onNavigate("transfer")}>
            <span className="nav-icon">⇄</span>
            Transfer
          </button>
          <button className={`nav-btn${activeTab === "loans" ? " active" : ""}`} onClick={() => onNavigate("loans")}>
            <span className="nav-icon">💳</span>
            Loans
          </button>
          <button className={`nav-btn${activeTab === "profile" ? " active" : ""}`} onClick={() => onNavigate("profile")}>
            <span className="nav-icon">👤</span>
            Profile
          </button>
        </div>
      </div>
    </div>
  );
}
