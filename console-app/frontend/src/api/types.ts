export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface OperationSummary {
  opKey: string;
  operationId: string;
  service: string;
  sourceFile: string;
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  documented: boolean;
  knownIssue: string | null;
}

export interface ParamInfo {
  name: string;
  location: "path" | "query";
  required: boolean;
  schema: JsonSchema;
  description: string;
}

export interface JsonSchema {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  [key: string]: unknown;
}

export interface AutofillHint {
  value: unknown;
  reason: string;
}

export interface OperationDetail extends OperationSummary {
  description: string;
  baseUrl: string;
  parameters: ParamInfo[];
  requestSchema: JsonSchema | null;
  responseSchema: JsonSchema | null;
  autofillHints: Record<string, AutofillHint>;
}

export interface CatalogResponse {
  totalOperations: number;
  services: Record<string, Record<string, OperationSummary[]>>;
}

export interface ConfigResponse {
  companyId: string;
  systemDate: string;
  environmentLabel: string;
  environmentPrefix: string;
  baseUrls: Record<string, string>;
}

export interface EnvironmentResponse {
  label: string;
  prefix: string;
  seed: string;
  region: string;
  baseUrls: Record<string, string>;
}

export interface TestEndpointResponse {
  ok: boolean;
  statusCode?: number;
  message?: string;
}

export interface LLMConfigResponse {
  provider: string;
  model: string;
  hasApiKey: boolean; // the key itself is never sent to the browser
}

export interface PreparePreview {
  method: HttpMethod;
  url: string;
  query: Record<string, unknown>;
  body: Record<string, unknown> | null;
}

export interface PrepareResponse {
  pendingExecutionId: string;
  opKey: string;
  summary: string;
  knownIssue: string | null;
  documented: boolean;
  preview: PreparePreview;
  missingRequired: string[];
  autofilled: Record<string, string>;
  readyToExecute: boolean;
}

export interface ExecuteResponse {
  opKey: string;
  request: PreparePreview;
  ok: boolean;
  statusCode: number | null;
  data: unknown;
  errors: string[];
  durationMs: number;
}

export interface AssistantMatchedResponse extends PrepareResponse {
  matched: true;
  confidence: number | null;
}

export interface AssistantUnmatchedResponse {
  matched: false;
  message: string;
  candidates?: OperationSummary[];
}

export type AssistantResponse = AssistantMatchedResponse | AssistantUnmatchedResponse;

export interface DiscoveredArrangement {
  accountId: string; // bare numeric id, e.g. "1013718397"
  companyAccountId: string; // "GB0010001-1013718397", for the Holdings query-layer endpoints
  label: string; // full one-line summary incl. id, for dropdown <option> text
  typeLabel: string; // just the product type / real name, e.g. "Current Accounts"
  kind: "account" | "loan";
  currency: string;
  status: string;
}
