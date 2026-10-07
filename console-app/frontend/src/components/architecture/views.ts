/* Composable Banking architecture views, redrawn from the Temenos architecture
 * pictures. Boxes, labels, arrows and their direction follow the source
 * pictures one-to-one; only the styling and layout coordinates are ours. */

import type { FEdge, FNode, FlowView } from "./FlowDiagram";
import type { LayeredView } from "./LayeredDiagram";

export type ArchView =
  | { id: string; group: string; title: string; subtitle: string; type: "flow"; view: FlowView }
  | { id: string; group: string; title: string; subtitle: string; type: "layered"; view: LayeredView };

/* ---------- shared runtime layout (Deposits / Lending) ---------- */

const topRow = (authLabel: string): FNode[] => [
  { id: "cust", x: 30, y: 30, w: 140, h: 46, tone: "actor", icon: "user", label: "Customization" },
  { id: "auth", x: 190, y: 30, w: 190, h: 46, tone: "actor", label: authLabel },
  { id: "user", x: 470, y: 30, w: 90, h: 46, tone: "actor", icon: "user", label: "User" },
  { id: "channels", x: 590, y: 26, w: 150, h: 54, tone: "channel", label: "Channels" },
];

function runtimeView(opts: {
  product: string;
  mdal: string;
  events: string;
  enterprise: { id: string; label: string }[];
  subLedger: boolean;
}): FlowView {
  const ent = opts.enterprise;
  const step = ent.length === 4 ? 58 : 74;
  const boxH = ent.length === 4 ? 48 : 56;
  const entNodes: FNode[] = ent.map((e, i) => ({
    id: e.id, x: 880, y: 156 + i * step, w: 320, h: boxH, tone: "temenos", db: true, label: e.label,
  }));
  const mid = (id: string) => {
    const n = entNodes.find((x) => x.id === id)!;
    return n.y + n.h / 2;
  };

  const nodes: FNode[] = [
    ...topRow("Authentication & Authorization"),
    { id: "adaptor", x: 790, y: 26, w: 170, h: 50, tone: "temenos", label: "ms_Adaptor" },
    { id: "core", kind: "core", x: 30, y: 170, w: 600, h: 310 },
    { id: "workbench", x: 44, y: 188, w: 56, h: 278, tone: "module", vertical: true, label: "Work-Bench (Extensibility Framework)" },
    { id: "iris", x: 112, y: 188, w: 340, h: 48, tone: "module", label: "IRIS (Interaction Framework)" },
    { id: "headline", kind: "headline", x: 112, y: 244, w: 340, h: 100, label: opts.product },
    { id: "regional", x: 112, y: 352, w: 165, h: 44, tone: "module", label: "Regional Solutions" },
    { id: "embedded", x: 287, y: 352, w: 165, h: 44, tone: "module", label: "Embedded Reference & Market data" },
    { id: "mdal", x: 112, y: 406, w: 340, h: 60, tone: "module", label: opts.mdal },
    { id: "events", x: 464, y: 188, w: 56, h: 278, tone: "module", vertical: true, label: opts.events },
    { id: "depositdb", x: 540, y: 396, w: 76, h: 70, tone: "module", db: true, label: "Deposit DB" },
    { id: "bus", x: 680, y: 170, w: 54, h: 310, tone: "bus", vertical: true, label: "Event streaming" },
    { id: "ent", kind: "group", x: 860, y: 116, w: 360, h: ent.length === 4 ? 284 : 270, tone: "temenos", label: "Enterprise Systems" },
    ...entNodes,
    { id: "fw", kind: "group", x: 860, y: 480, w: 360, h: 200, tone: "framework", label: "Framework Services" },
    { id: "es", x: 880, y: 520, w: 320, h: 56, tone: "framework", db: true, label: "ms_EventStore" },
    { id: "cfg", x: 880, y: 600, w: 320, h: 56, tone: "framework", db: true, label: "ms_Configurations" },
    { id: "party", x: 60, y: 580, w: 170, h: 56, tone: "temenos", db: true, label: "ms_Party" },
    { id: "cache", x: 270, y: 580, w: 150, h: 56, tone: "cache", icon: "cache", label: "Master Data Cache" },
    { id: "holdings", x: 500, y: 600, w: 220, h: 56, tone: "temenos", db: true, label: "ms_Holdings" },
  ];
  if (opts.subLedger) {
    nodes.push({ id: "subledger", x: 740, y: 562, w: 110, h: 50, tone: "temenos", db: true, label: "Sub-Ledger" });
  }

  const holdingsTop = opts.subLedger ? 695 : 707;
  const edges: FEdge[] = [
    { from: "user:r", to: "channels:l:@53", kind: "sync", label: "User", lp: [575, 14] },
    { from: "channels:b:0.3", to: "iris:t:@380", via: [[635, 116], [380, 116]], kind: "sync", label: "API Calls", lp: [500, 116] },
    { from: "auth:b:@285", to: "iris:t:@285", kind: "sync" },
    { from: "cust:b:@72", to: "workbench:t", kind: "sync", label: "Customization", lp: [72, 98] },
    {
      from: "adaptor:t", to: "iris:t:@440", via: [[875, 12], [440, 12]], kind: "sync",
      label: "Adapter POST API for Product/Pricing/Payment events", lp: [660, 12],
    },
    {
      from: "channels:b:0.05", to: "party:l", via: [[597.5, 132], [16, 132], [16, 608]], kind: "sync",
      label: "Query Customer Information", lp: [190, 132],
    },
    {
      from: "channels:b:0.15", to: "holdings:b:@610", via: [[612.5, 146], [8, 146], [8, 740], [610, 740]], kind: "sync",
      label: "Query Balance & Transaction info", lp: [300, 740],
    },
    { from: "cfg:r", to: "adaptor:r", via: [[1250, 628], [1250, 51]], kind: "sync", label: "Adaptor Routes", lp: [1105, 51] },
    {
      from: `${ent.find((e) => e.label === "Pricing Manager")!.id}:r`, to: "holdings:b:@665",
      via: [[1235, mid("prm")], [1235, 756], [665, 756]], kind: "sync",
      label: "Pricing and Payments query\nbalance & txn data", lp: [950, 756],
    },
    { from: "pay:r", to: "holdings:b:@665", via: [[1235, mid("pay")], [1235, 756], [665, 756]], kind: "sync" },

    { from: "mdal:b:@150", to: "party:t:@150", kind: "data", label: "Cache miss,\nQuery CIF system", lp: [150, 522] },
    { from: "mdal:b:@300", to: "cache:t:@300", kind: "data", label: "Try cached data", lp: [306, 522] },
    {
      from: "party:b:@145", to: "cache:b:@345", via: [[145, 668], [345, 668]], kind: "data-async",
      label: "Party created/modified event", lp: [245, 668],
    },
    { from: "cfg:b:@925", to: "mdal:b:@440", via: [[925, 700], [440, 700]], kind: "data", label: "MDAL End-Points", lp: [800, 700] },

    { from: "events:r", to: "bus:l:@327", kind: "async", label: "Events", lp: [600, 327] },
    {
      from: "bus:t", to: "adaptor:b", via: [[707, 100], [875, 100]], kind: "async",
      label: "Events from Product, Pricing\nand Payment systems", lp: [790, 100],
    },
    ...entNodes.map<FEdge>((n, i) => ({
      from: `bus:r:@${n.y + n.h / 2}`, to: `${n.id}:l`, kind: "async", both: true,
      ...(i === 0 ? { label: "Events from/to\nEnterprise Services", lp: [797, (n.y + n.h / 2 + mid(entNodes[1].id)) / 2] as [number, number] } : {}),
    })),
    { from: "bus:r:@399", to: "es:t:@1040", kind: "async", label: "Events from\nAll systems", lp: [800, 399] },
    {
      from: "es:l", to: "bus:r:@464", via: [[810, 548], [810, 464]], kind: "async",
      label: "Events routed to\noriginator's outbox", lp: [810, 510],
    },
    {
      from: `bus:b:@${holdingsTop}`, to: `holdings:t:@${holdingsTop}`, kind: "async",
      label: "Contract &\nTransaction data", lp: opts.subLedger ? [650, 572] : [707, 572],
    },
  ];
  if (opts.subLedger) {
    edges.push({ from: "bus:b:@725", to: "subledger:l", via: [[725, 587]], kind: "data" });
  }
  return { width: 1270, height: 780, nodes, edges };
}

/* ---------- Deposits: component view ---------- */

const depositsComponents: FlowView = {
  width: 1300,
  height: 920,
  nodes: [
    ...topRow("Authentication & Authorisation"),
    { id: "core", kind: "core", x: 30, y: 170, w: 600, h: 310 },
    { id: "ext", x: 44, y: 188, w: 56, h: 278, tone: "module", vertical: true, label: "Extensibility Framework" },
    { id: "iris", x: 112, y: 188, w: 340, h: 48, tone: "module", label: "IRIS (Interaction Framework)" },
    { id: "headline", kind: "headline", x: 112, y: 240, w: 340, h: 52, label: "Modular Deposit" },
    { id: "m1", x: 112, y: 298, w: 108, h: 44, tone: "module", label: "Product Setups" },
    { id: "m2", x: 228, y: 298, w: 108, h: 44, tone: "module", label: "Contract Management" },
    { id: "m3", x: 344, y: 298, w: 108, h: 44, tone: "module", label: "Interest & Charges" },
    { id: "m4", x: 112, y: 350, w: 108, h: 44, tone: "module", label: "Schedules" },
    { id: "m5", x: 228, y: 350, w: 108, h: 44, tone: "module", label: "Transactions" },
    { id: "m6", x: 344, y: 350, w: 108, h: 44, tone: "module", label: "Reference & Market data" },
    { id: "mdal", x: 112, y: 404, w: 340, h: 62, tone: "module", label: "MDAL (Integration framework)" },
    { id: "events", x: 464, y: 188, w: 56, h: 278, tone: "module", vertical: true, label: "Events (Integration Framework)" },
    { id: "depositdb", x: 540, y: 396, w: 76, h: 70, tone: "module", db: true, label: "Deposit DB" },
    { id: "bus", x: 680, y: 170, w: 54, h: 520, tone: "bus", vertical: true, label: "Events Streaming Platform" },
    { id: "fw", kind: "group", x: 860, y: 110, w: 360, h: 280, tone: "framework", label: "Framework Services" },
    { id: "es", x: 880, y: 150, w: 320, h: 56, tone: "framework", db: true, label: "Event Store MS" },
    { id: "adapter", x: 880, y: 224, w: 320, h: 56, tone: "framework", label: "Adapter MS" },
    { id: "cfg", x: 880, y: 298, w: 320, h: 56, tone: "framework", db: true, label: "Config MS" },
    { id: "ent", kind: "group", x: 860, y: 470, w: 360, h: 250, tone: "temenos", label: "Enterprise services" },
    { id: "pm", x: 880, y: 510, w: 320, h: 50, tone: "temenos", db: true, label: "Product manager" },
    { id: "prm", x: 880, y: 580, w: 320, h: 50, tone: "temenos", db: true, label: "Pricing Manager" },
    { id: "pay", x: 880, y: 650, w: 320, h: 50, tone: "temenos", db: true, label: "Payments" },
    { id: "cache", x: 46, y: 508, w: 198, h: 50, tone: "cache", icon: "cache", label: "Cache Memory" },
    { id: "master", kind: "group", x: 30, y: 596, w: 230, h: 106, tone: "framework", label: "Master System" },
    { id: "custinfo", x: 46, y: 634, w: 198, h: 52, tone: "framework", db: true, label: "Customer Information" },
    { id: "cors", kind: "group", x: 560, y: 760, w: 260, h: 104, tone: "thirdparty", label: "CORS" },
    { id: "holdings", x: 578, y: 794, w: 224, h: 50, tone: "navy", db: true, label: "Holdings" },
  ],
  edges: [
    { from: "user:r", to: "channels:l:@53", kind: "sync" },
    { from: "channels:b:0.3", to: "iris:t:@380", via: [[635, 116], [380, 116]], kind: "sync", label: "API Call", lp: [500, 116] },
    { from: "iris:t:@285", to: "auth:b:@285", kind: "sync" },
    { from: "cust:b:@72", to: "ext:t", kind: "sync" },
    {
      from: "adapter:r:@240", to: "iris:t:@440", via: [[1265, 240], [1265, 12], [440, 12]], kind: "sync",
      label: "Adapter POST API for Product/Pricing/Payment events", lp: [800, 12],
    },
    { from: "adapter:r:@266", to: "cfg:r:@312", via: [[1235, 266], [1235, 312]], kind: "sync", label: "Adapter\nRoutes", lp: [1235, 289] },
    { from: "bus:r:@178", to: "es:l", kind: "async", both: true, label: "Deposit events", lp: [807, 178] },
    {
      from: "bus:r:@252", to: "adapter:l", kind: "async",
      label: "Events from Product,\nPricing and Payments\nsystems", lp: [807, 252],
    },
    { from: "pm:l", to: "bus:r:@535", kind: "async", label: "Product Update event", lp: [807, 535] },
    { from: "prm:l", to: "bus:r:@605", kind: "async", label: "Pricing events", lp: [807, 605] },
    { from: "pay:l", to: "bus:r:@675", kind: "async", label: "Payment\nProcessing Event", lp: [807, 675] },
    { from: "events:r", to: "bus:l:@327", kind: "async", label: "Events", lp: [600, 327] },
    { from: "bus:b:@707", to: "holdings:t:@707", kind: "async", label: "Contract / Transaction\nevents", lp: [707, 715] },
    { from: "mdal:b:@150", to: "cache:t:@150", kind: "sync", label: "First try cache,\nCached Party Data", lp: [150, 487] },
    {
      from: "mdal:b:@330", to: "custinfo:r", via: [[330, 660]], kind: "sync",
      label: "Cache Miss,\nQueries Party Data", lp: [330, 540],
    },
    { from: "custinfo:t:@200", to: "cache:b:@200", kind: "async", label: "Party Create/\nUpdate event", lp: [118, 577] },
    {
      from: "channels:b:0.05", to: "custinfo:l", via: [[597.5, 132], [16, 132], [16, 660]], kind: "sync",
      label: "UA Query Party Data", lp: [190, 132],
    },
    {
      from: "channels:b:0.15", to: "holdings:b:@600", via: [[612.5, 146], [8, 146], [8, 896], [600, 896]], kind: "sync",
      label: "UA Queries Transaction data", lp: [300, 896],
    },
    {
      from: "pay:r", to: "holdings:b:@700", via: [[1242, 675], [1242, 866], [700, 866]], kind: "sync",
      label: "Payments Query Account Info", lp: [990, 866],
    },
    {
      from: "prm:r", to: "holdings:b:@760", via: [[1256, 605], [1256, 904], [760, 904]], kind: "sync",
      label: "Pricing Query Transactional Data", lp: [1010, 904],
    },
    {
      from: "mdal:b:@442", to: "cfg:r:@340", via: [[442, 738], [1282, 738], [1282, 340]], kind: "sync",
      label: "MDAL End-Point", lp: [560, 738],
    },
  ],
};

/* ---------- Payments runtime ---------- */

const paymentsRuntime: FlowView = {
  width: 1200,
  height: 640,
  nodes: [
    { id: "channels", x: 40, y: 60, w: 180, h: 60, tone: "thirdparty", label: "Channels" },
    { id: "dp", kind: "group", x: 40, y: 180, w: 200, h: 270, tone: "framework", label: "Data Providers" },
    { id: "party", x: 70, y: 240, w: 140, h: 56, tone: "temenos", label: "Party" },
    { id: "holdings", x: 70, y: 340, w: 140, h: 56, tone: "temenos", label: "Holdings" },
    { id: "core", kind: "core", x: 300, y: 40, w: 270, h: 420, label: "Composable Payments" },
    { id: "headline", kind: "headline", x: 300, y: 48, w: 270, h: 46, label: "Composable Payments" },
    { id: "iris", x: 320, y: 100, w: 230, h: 44, tone: "navy", label: "APIs (IRIS)" },
    { id: "pis", x: 320, y: 156, w: 230, h: 80, tone: "navy", label: "Payment Initiation Service", sub: "Create · Validate · Enrich · Status · Lifecycle" },
    { id: "tph", x: 320, y: 248, w: 230, h: 80, tone: "navy", label: "TPH – Transaction Processing Hub", sub: "Routing · Clearing · Settlement" },
    { id: "mdal", x: 320, y: 396, w: 230, h: 48, tone: "navy", label: "MDAL" },
    { id: "ps", kind: "group", x: 630, y: 110, w: 220, h: 350, tone: "framework", label: "Platform Services" },
    { id: "cfg", x: 650, y: 150, w: 180, h: 56, tone: "temenos", label: "Config MS" },
    { id: "adapter", x: 650, y: 260, w: 180, h: 56, tone: "temenos", label: "Adapter Framework" },
    { id: "esaga", x: 650, y: 370, w: 180, h: 64, tone: "temenos", label: "Event Store & SAGA Orchestration" },
    { id: "ss", kind: "group", x: 910, y: 110, w: 250, h: 350, tone: "framework", label: "Servicing systems" },
    { id: "tsys", x: 935, y: 170, w: 200, h: 70, tone: "navy", label: "Temenos Systems" },
    { id: "ext", x: 935, y: 300, w: 200, h: 70, tone: "thirdparty", label: "External System" },
    { id: "bus", x: 40, y: 540, w: 1120, h: 56, tone: "bus", label: "EVENT BUS/ PUB-SUB" },
  ],
  edges: [
    { from: "channels:r", to: "iris:l", via: [[270, 90], [270, 122]], kind: "sync" },
    { from: "mdal:l:@413", to: "party:r", via: [[270, 413], [270, 268]], kind: "sync" },
    { from: "mdal:l:@431", to: "holdings:r", via: [[258, 431], [258, 368]], kind: "sync" },
    { from: "cfg:b", to: "adapter:t", kind: "sync", both: true },
    { from: "adapter:r:@288", to: "tsys:l", via: [[890, 288], [890, 205]], kind: "sync" },
    { from: "adapter:r:@288", to: "ext:l", via: [[890, 288], [890, 335]], kind: "sync" },
    { from: "adapter:r:@272", to: "core:t", via: [[870, 272], [870, 20], [435, 20]], kind: "sync" },
    { from: "core:b", to: "bus:t:@435", kind: "async" },
    { from: "bus:t:@610", to: "adapter:l", via: [[610, 288]], kind: "async" },
    { from: "esaga:b", to: "bus:t:@740", kind: "async", both: true },
    { from: "tsys:r", to: "bus:t:@1150", via: [[1150, 205]], kind: "async" },
    { from: "ext:b", to: "bus:t:@1035", kind: "async" },
  ],
};

/* ---------- Product & Pricing ---------- */

const pricing: FlowView = {
  width: 1210,
  height: 700,
  nodes: [
    { id: "channels", x: 40, y: 20, w: 1000, h: 80, tone: "framework", label: "Channels", items: ["📱", "🖱️", "🎧", "🏛️", "🧑‍💼"] },
    { id: "runtime", kind: "group", x: 40, y: 128, w: 1000, h: 236, tone: "framework", dashed: true, label: "Run Time" },
    { id: "ds", kind: "group", x: 70, y: 160, w: 250, h: 110, tone: "salmon", label: "Data Sources" },
    { id: "party", x: 86, y: 202, w: 110, h: 48, tone: "salmon", label: "Party" },
    { id: "holdings", x: 206, y: 202, w: 100, h: 48, tone: "salmon", label: "Holdings" },
    { id: "engine", x: 400, y: 160, w: 170, h: 110, tone: "lime", label: "Temenos Pricing Engine" },
    { id: "serv", kind: "group", x: 640, y: 160, w: 380, h: 110, tone: "framework", label: "Servicing Systems" },
    { id: "tcore", x: 656, y: 202, w: 110, h: 48, tone: "framework", label: "Temenos Core" },
    { id: "ocore", x: 776, y: 202, w: 110, h: 48, tone: "framework", label: "Other Core" },
    { id: "oserv", x: 896, y: 202, w: 110, h: 48, tone: "framework", label: "Other Servicing" },
    { id: "note1", x: 170, y: 296, w: 220, h: 46, tone: "salmon", label: "Customer, Accounts, Transaction, Balances" },
    { id: "note2", x: 590, y: 296, w: 200, h: 46, tone: "lime", label: "Charges, Interest Rates, Cashback" },
    { id: "design", kind: "group", x: 40, y: 400, w: 1000, h: 280, tone: "navy", label: "Design Time · Temenos Product and Pricing Manager" },
    { id: "products", x: 70, y: 446, w: 820, h: 96, tone: "framework", label: "Products", items: ["Savings", "Current", "Deposits", "Lending", "Other Products"] },
    {
      id: "pricing", x: 70, y: 560, w: 820, h: 100, tone: "framework", label: "Pricing",
      items: ["Products", "Regional", "Fees", "Interest Grids", "Segment Plans", "Loyalty", "Packages", "Promotions"],
    },
    { id: "tpm", x: 910, y: 446, w: 110, h: 214, tone: "navy", vertical: true, label: "TPM MS" },
    { id: "ppc", x: 1070, y: 318, w: 120, h: 84, tone: "navy", label: "Product & Pricing Configuration" },
  ],
  edges: [
    { from: "channels:b:@485", to: "engine:t:@485", kind: "sync", both: true },
    { from: "channels:b:@830", to: "serv:t:@830", kind: "sync", both: true },
    { from: "serv:t:@676", to: "ds:t:@195", via: [[676, 144], [195, 144]], kind: "sync" },
    { from: "ds:b:@120", to: "note1:l", via: [[120, 319]], kind: "data" },
    { from: "note1:r", to: "engine:b:@460", via: [[460, 319]], kind: "data" },
    { from: "engine:b:@545", to: "note2:l", via: [[545, 319]], kind: "data" },
    { from: "note2:r", to: "serv:b:@830", via: [[830, 319]], kind: "data" },
    { from: "tpm:r", to: "ppc:b", via: [[1130, 553]], kind: "sync" },
    { from: "ppc:t", to: "serv:r", via: [[1130, 215]], kind: "sync", label: "< Financial Products >", lp: [1118, 262] },
    { from: "ppc:l:@382", to: "engine:b:@512", via: [[512, 382]], kind: "sync", label: "< Pricing Config >", lp: [800, 382] },
  ],
};

/* ---------- Layered system views ---------- */

const CHANNELS = ["Clearing", "ATM/Files Online", "Internet Banking", "Mobile", "Branch", "Open Banking API"];
const COMMON = {
  title: "Common Features (Optimised for deposit solution)",
  items: ["Application Framework", "Extensibility", "System Tables", "COB", "TAFJ", "…"].map((name) => ({ name, tone: "navy" as const })),
};
const FRAMEWORKS = {
  title: "Frameworks",
  items: ["API (IRIS)", "Events", "MDAL"].map((name) => ({ name, tone: "navy" as const })),
};
const PLATFORM = {
  title: "Platform Services",
  items: ["Event Store", "Adapter Framework", "Config MS"].map((name) => ({ name, tone: "temenos" as const })),
};
const DATA_REPORTING = {
  title: "Data and Reporting",
  items: [
    { name: "General Ledger", tone: "thirdparty" as const },
    { name: "Data Hub", tone: "temenos" as const },
    { name: "Analytics", tone: "temenos" as const },
    { name: "Reports", tone: "thirdparty" as const },
    { name: "…", tone: "thirdparty" as const },
  ],
};

const lendingSystem: LayeredView = {
  channels: CHANNELS,
  experience: "Unified Customer Experience Platform",
  top: {
    title: "Enterprise Services",
    items: [
      { name: "Product Manager", tone: "temenos" },
      { name: "Payments", tone: "temenos" },
      { name: "Pricing Manager", tone: "temenos" },
      { name: "Limits", tone: "thirdparty" },
      { name: "Other Service", tone: "thirdparty" },
    ],
  },
  topSide: { name: "External Core", tone: "thirdparty" },
  core: {
    title: "Retail Lending capabilities",
    columns: [
      COMMON,
      {
        title: "Lending",
        items: ["Lending Lifecycle and Servicing", "Embedded Reference & Market Data", "Regional Solutions"].map((name) => ({ name, tone: "navy" as const })),
      },
      FRAMEWORKS,
    ],
  },
  left: PLATFORM,
  right: {
    title: "Supporting Services",
    items: [
      { name: "Sub Ledger", tone: "salmon" },
      { name: "Party", tone: "temenos" },
      { name: "Holdings", tone: "temenos" },
    ],
  },
  bottom: DATA_REPORTING,
};

const paymentsSystem: LayeredView = {
  channels: CHANNELS,
  top: {
    title: "Data sources & Integration",
    items: [
      { name: "Party", tone: "temenos" },
      { name: "Holdings", tone: "temenos" },
      { name: "FCM", tone: "temenos" },
      { name: "Other Service", tone: "thirdparty" },
    ],
  },
  core: {
    title: "Composable Payments system",
    columns: [
      COMMON,
      {
        title: "Payments",
        items: ["Payments Initiation", "Payments Execution", "Embedded Reference & Market Data", "Regional Solutions"].map((name) => ({ name, tone: "navy" as const })),
      },
      FRAMEWORKS,
    ],
  },
  left: PLATFORM,
  right: {
    title: "Servicing Systems",
    items: [
      { name: "Deposits", tone: "temenos" },
      { name: "Lending", tone: "temenos" },
      { name: "External Core", tone: "thirdparty" },
    ],
  },
  bottom: DATA_REPORTING,
};

export const ARCH_VIEWS: ArchView[] = [
  {
    id: "deposits-runtime", group: "Deposits", title: "Runtime architecture", subtitle: "Modular Deposits and Accounts", type: "flow",
    view: runtimeView({
      product: "Modular Deposits and Accounts",
      mdal: "MDAL (Integration Framework)",
      events: "Events (Integration Framework)",
      enterprise: [
        { id: "pm", label: "Product Manager" },
        { id: "prm", label: "Pricing Manager" },
        { id: "pay", label: "Payments" },
      ],
      subLedger: false,
    }),
  },
  { id: "deposits-components", group: "Deposits", title: "Component view", subtitle: "Modular Deposit", type: "flow", view: depositsComponents },
  { id: "lending-system", group: "Lending", title: "System architecture", subtitle: "Retail Lending capabilities", type: "layered", view: lendingSystem },
  {
    id: "lending-runtime", group: "Lending", title: "Runtime architecture", subtitle: "Composable Lending", type: "flow",
    view: runtimeView({
      product: "Composable Lending",
      mdal: "MDAL (Master Data Access Layer)",
      events: "Events",
      enterprise: [
        { id: "pm", label: "Product Manager" },
        { id: "prm", label: "Pricing Manager" },
        { id: "limits", label: "Limits" },
        { id: "pay", label: "Payments" },
      ],
      subLedger: true,
    }),
  },
  { id: "payments-system", group: "Payments", title: "System architecture", subtitle: "Composable Payments system", type: "layered", view: paymentsSystem },
  { id: "payments-runtime", group: "Payments", title: "Runtime architecture", subtitle: "Composable Payments", type: "flow", view: paymentsRuntime },
  { id: "pricing", group: "Product & Pricing", title: "Design time & run time", subtitle: "Temenos Product and Pricing Manager", type: "flow", view: pricing },
];
