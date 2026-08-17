import { useMobileSession } from "../../../context/MobileSessionContext";
import { useParty } from "../../../context/PartyContext";

export function ProfileScreen() {
  const { customer, partyId } = useMobileSession();
  const { setActivePartyId } = useParty();

  if (!customer) {
    return (
      <div className="screen screen-center">
        <div className="empty-state">No customer data</div>
      </div>
    );
  }

  const rows: [string, string][] = [
    ["Party ID", partyId || ""],
    ["Title", customer.title],
    ["Date of Birth", customer.dateOfBirth],
    ["Gender", customer.gender],
    ["Marital Status", customer.maritalStatus],
    ["City of Birth", customer.cityOfBirth],
  ];

  return (
    <div className="screen">
      <div className="section-label">Profile</div>
      <div className="profile-name">
        {customer.firstName} {customer.lastName}
      </div>
      <div className="profile-list">
        {rows.map(([label, value]) => (
          <div key={label} className="profile-row">
            <span className="profile-label">{label}</span>
            <span className="profile-value">{value || "-"}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary btn-block" onClick={() => setActivePartyId(null)}>
        Switch Customer
      </button>
    </div>
  );
}
