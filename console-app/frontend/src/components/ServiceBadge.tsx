/** Which backend an operation is actually sent to. The Catalog groups by API
 * domain (holdings/order/party/reference), so this is the only place the
 * routing shows: party data goes to the Party microservice, Deposits and
 * Lending operations to their own pods, aggregated reads to Holdings. */
const KIND: Record<string, string> = {
  Party: "microservice",
  Holdings: "microservice",
  Deposits: "pod",
  Lending: "pod",
};

export function ServiceBadge({ service, long = false }: { service: string; long?: boolean }) {
  const kind = KIND[service] ?? "service";
  return (
    <span className={`service-badge ${service.toLowerCase()}`} title={`Sent to the ${service} ${kind}`}>
      {long ? `→ ${service} ${kind}` : service}
    </span>
  );
}
