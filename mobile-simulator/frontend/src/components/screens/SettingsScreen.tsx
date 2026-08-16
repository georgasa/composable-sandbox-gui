import { SKINS, useTheme } from "../../context/ThemeContext";

interface Props {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: Props) {
  const { skinId, setSkinId } = useTheme();

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onClose}>
          ← Back
        </button>
        <div className="screen-title">Settings</div>
      </div>
      <div className="section-label">Look &amp; Feel</div>
      <div className="skin-list">
        {SKINS.map((skin) => (
          <button
            key={skin.id}
            className={`skin-card${skin.id === skinId ? " active" : ""}`}
            onClick={() => setSkinId(skin.id)}
            data-skin={skin.id}
          >
            <div className="skin-swatch">
              <span className="skin-swatch-primary" />
              <span className="skin-swatch-accent" />
            </div>
            <div className="skin-card-text">
              <div className="skin-card-label">{skin.label}</div>
              <div className="skin-card-desc">{skin.description}</div>
            </div>
            {skin.id === skinId && <span className="skin-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
