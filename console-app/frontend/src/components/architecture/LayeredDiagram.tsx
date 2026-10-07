/** Layered "system architecture" view: channels on top, a product core in
 * the middle flanked by side services, data and reporting at the bottom. */

export type LTone = "temenos" | "navy" | "thirdparty" | "salmon";

export interface LItem {
  name: string;
  tone: LTone;
}

export interface LBand {
  title: string;
  items: LItem[];
}

export interface LayeredView {
  channels: string[];
  experience?: string;
  top: LBand;
  topSide?: LItem;
  core: { title: string; columns: LBand[] };
  left: LBand;
  right: LBand;
  bottom: LBand;
}

function Tile({ item }: { item: LItem }) {
  return <div className={`arch-tile arch-tile-${item.tone}`}>{item.name}</div>;
}

function Band({ band, className }: { band: LBand; className: string }) {
  return (
    <section className={`arch-band ${className}`}>
      <h4>{band.title}</h4>
      <div className="arch-band-items">
        {band.items.map((i) => (
          <Tile key={i.name} item={i} />
        ))}
      </div>
    </section>
  );
}

export function LayeredDiagram({ view }: { view: LayeredView }) {
  return (
    <div className="arch-layered">
      <section className="arch-band arch-channels">
        <h4>Channels</h4>
        <div className="arch-band-items">
          {view.channels.map((c) => (
            <span key={c} className="arch-channel">
              {c}
            </span>
          ))}
        </div>
      </section>

      {view.experience && <div className="arch-experience">{view.experience}</div>}

      <div className="arch-top-row" style={view.topSide ? undefined : { gridTemplateColumns: "1fr" }}>
        <Band band={view.top} className="arch-top" />
        {view.topSide && (
          <div className="arch-top-side">
            <Tile item={view.topSide} />
          </div>
        )}
      </div>

      <div className="arch-middle">
        <Band band={view.left} className="arch-side" />
        <section className="arch-product">
          <h3>{view.core.title}</h3>
          <div className="arch-product-cols">
            {view.core.columns.map((col) => (
              <div key={col.title} className="arch-product-col">
                <h4>{col.title}</h4>
                <div className="arch-product-items">
                  {col.items.map((i) => (
                    <Tile key={i.name} item={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <Band band={view.right} className="arch-side" />
      </div>

      <Band band={view.bottom} className="arch-bottom" />

      <div className="arch-legend">
        <span className="arch-legend-item">
          <i className="arch-swatch arch-tile-temenos" />
          <i className="arch-swatch arch-tile-navy" />
          Temenos products
        </span>
        <span className="arch-legend-item">
          <i className="arch-swatch arch-tile-thirdparty" />
          3rd Party Products
        </span>
      </div>
    </div>
  );
}
