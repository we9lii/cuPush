
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export interface User {
  id: string;
  username: string;
  password?: string; // Added for authentication
  name: string; // Full name to display
  role: UserRole;
}

export interface ClientRecord {
  id: string;
  clientName: string;
  mobileNumber: string;
  region: string;
  systemSizeKw: number;
  pricePerKw: number; // Excluding tax
  lastUpdateNote: string;
  employeeId: string;
  employeeName: string;
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  adminSeen?: boolean; // Track if admin has viewed the latest update
}

export interface Stats {
  totalClients: number;
  totalSystemSize: number;
  totalProjectValue: number;
}
