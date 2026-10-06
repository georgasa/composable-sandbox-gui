interface Diagram {
  src: string;
  title: string;
  caption: string;
}

const LOAN_FLOW: Diagram = {
  src: "/diagrams/loan-integration-flow.png",
  title: "How a loan flows through the services",
  caption:
    "From creating the loan in Lending (1) to reading its balance from Holdings (16): events travel through " +
    "EventStore and Kafka, the adapter executes the payout against Deposits, and Holdings is fed by the " +
    "balance and transaction events. Click the image to open it full size.",
};

/** Explanatory diagrams shown under specific operations, keyed by opKey. */
const DIAGRAMS: Record<string, Diagram> = {
  "Lending/holdings-loans-service-v1.0.0:POST:/holdings/lending/consumerLoans": LOAN_FLOW,
};

export function OperationDiagram({ opKey }: { opKey: string }) {
  const diagram = DIAGRAMS[opKey];
  if (!diagram) return null;
  return (
    <details className="op-diagram" open>
      <summary>{diagram.title}</summary>
      <p className="op-diagram-caption">{diagram.caption}</p>
      <a href={diagram.src} target="_blank" rel="noreferrer">
        <img src={diagram.src} alt={diagram.title} />
      </a>
    </details>
  );
}
