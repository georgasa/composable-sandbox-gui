// Mirrors mobile-simulator/backend/app/api/mobile_routes.py response shapes.

/** One real HTTP call the backend made to the live sandbox while handling a
 * Mobile tab action -- see app/mobile_sandbox_client.py's `log` param.
 * Every /mobile/* response carries the full list of these under
 * `apiCalls`, which is what the "Under the Hood" panel renders. */
export interface ApiCallRecord {
  method: string;
  url: string;
  requestBody: unknown;
  statusCode: number | null;
  ok: boolean;
  responseData: unknown;
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  currency: string;
  status: string;
  workingBalance: number;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  title: string;
  gender: string;
  maritalStatus: string;
  cityOfBirth: string;
  apiCalls: ApiCallRecord[];
}

export interface TransactionInfo {
  reference: string;
  date: string;
  narrative: string;
  amount: number;
  currency: string;
}

export interface AccountDetails {
  productName: string;
  status: string;
  openingDate: string;
  currency: string;
  apiCalls: ApiCallRecord[];
}

export interface LoanScheduleEntry {
  installmentNumber: number;
  date: string;
  principal: string;
  interest: string;
  balance: string;
}
