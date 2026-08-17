// Mirrors mobile-simulator/backend/app/api/mobile_routes.py response shapes.

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
}

export interface LoanScheduleEntry {
  installmentNumber: number;
  date: string;
  principal: string;
  interest: string;
  balance: string;
}
