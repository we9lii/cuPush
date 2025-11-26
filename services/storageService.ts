import { ClientRecord, User, UserRole, Stats } from '../types';

// =================================================================
// إعدادات الاتصال
// =================================================================

// غير هذا المتغير إلى false عند رفع الباك إند وتشغيله لكي يتصل بالسيرفر
// حالياً هو true لكي يعمل الموقع في المعاينة (Preview)
const IS_DEMO_MODE = false;

const API_BASE_URL = 'https://crmsolar-crm-backend.onrender.com/api'; // استبدل هذا برابط Render الخاص بك

// =================================================================
// Local Storage (Mock Data) - وضع المعاينة
// =================================================================
const CLIENTS_KEY = 'solar_app_clients';
const USERS_KEY = 'solar_app_users';
const CURRENT_USER_KEY = 'solar_app_current_user';

const INITIAL_USERS: User[] = [
  { id: 'u1', username: 'admin', password: '123', name: 'المشرف العام', role: UserRole.ADMIN },
  { id: 'u2', username: 'emp1', password: '123', name: ' dev', role: UserRole.EMPLOYEE },
  { id: 'u3', username: 'emp2', password: '123', name: ' dev2', role: UserRole.EMPLOYEE },
];

const INITIAL_CLIENTS: ClientRecord[] = [
  {
    id: 'c1',
    clientName: 'عميل تجريبي ',
    mobileNumber: '0501234567',
    region: 'القصيم',
    systemSizeKw: 100,
    pricePerKw: 1100,
    lastUpdateNote: 'تم الاتفاق مبدئياً',
    employeeId: 'u2',
    employeeName: ' dev',
    createdAt: new Date('2025-10-01').toISOString(),
    updatedAt: new Date('2025-10-05').toISOString(),
    adminSeen: true
  },
  {
    id: 'c2',
    clientName: 'عميل تجريبي 2 ',
    mobileNumber: '0598765432',
    region: 'حائل',
    systemSizeKw: 250,
    pricePerKw: 1100,
    lastUpdateNote: 'بانتظار الموافقة المالية',
    employeeId: 'u3',
    employeeName: ' dev2',
    createdAt: new Date('2024-10-10').toISOString(),
    updatedAt: new Date('2024-10-12').toISOString(),
    adminSeen: true
  }
];

const initStorage = () => {
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem(USERS_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(CLIENTS_KEY)) {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(INITIAL_CLIENTS));
    }
  }
};

if (IS_DEMO_MODE) initStorage();

// =================================================================
// Storage Service Implementation
// =================================================================

export const StorageService = {
  isDemo: IS_DEMO_MODE,

  // --- Auth & Users ---
  login: async (username: string, password: string): Promise<User | null> => {
    if (IS_DEMO_MODE) {
      const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const user = users.find((u: User) => u.username === username && u.password === password);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
        return userWithoutPassword;
      }
      return null;
    } else {
      // API Login
      try {
        const res = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) return null;
        const rawUser = await res.json();
        const normalizedUser = {
          ...rawUser,
          id: String(rawUser.id),
          role: String(rawUser.role).toUpperCase()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalizedUser));
        return normalizedUser;
      } catch (e) {
        console.error("Login Error", e);
        return null;
      }
    }
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      id: String(parsed.id),
      role: String(parsed.role).toUpperCase()
    };
  },

  getUsers: async (): Promise<User[]> => {
    if (IS_DEMO_MODE) {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } else {
      const res = await fetch(`${API_BASE_URL}/users`);
      return res.json();
    }
  },

  // Sync wrapper for Demo compatibility (Component expects sync in demo)
  getUsersSync: (): User[] => {
    if (IS_DEMO_MODE) return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return []; // Should use async in real mode
  },

  addUser: async (data: Omit<User, 'id'>): Promise<User> => {
    if (IS_DEMO_MODE) {
      const users = StorageService.getUsersSync();
      if (users.some(u => u.username === data.username)) {
        throw new Error('اسم المستخدم موجود مسبقاً');
      }
      const newUser: User = { ...data, id: crypto.randomUUID() };
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return newUser;
    } else {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      return result;
    }
  },

  deleteUser: async (id: string) => {
    if (IS_DEMO_MODE) {
      let users = StorageService.getUsersSync();
      const userToDelete = users.find(u => u.id === id);
      if (userToDelete?.username === 'admin') throw new Error('لا يمكن حذف المشرف الأساسي');
      users = users.filter(u => u.id !== id);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else {
      await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
    }
  },

  // --- Clients ---
  // In API mode, these must be awaited. In Demo, they are sync.
  // We will make them all return Promises or handle internally.

  getClients: async (): Promise<ClientRecord[]> => {
    if (IS_DEMO_MODE) {
      return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
    } else {
      const res = await fetch(`${API_BASE_URL}/clients`);
      return res.json();
    }
  },

  // Wrapper for components expecting sync data in demo mode
  // Note: To fully migrate, components should use useEffect + async calls.
  // For now, if IS_DEMO is false, components using this will break unless updated.
  // WE WILL UPDATE COMPONENTS TO USE ASYNC/AWAIT PATTERN OR PROMISES
  getClientsSync: (): ClientRecord[] => {
    if (IS_DEMO_MODE) return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
    return [];
  },

  addClient: async (data: any): Promise<ClientRecord> => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      if (clients.some(c => c.mobileNumber === data.mobileNumber)) {
        throw new Error('رقم الجوال مسجل مسبقاً');
      }
      const newClient: ClientRecord = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminSeen: false
      };
      clients.push(newClient);
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
      return newClient;
    } else {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      return result; // API should return the new client or at least ID
    }
  },

  updateClient: async (id: string, updates: Partial<ClientRecord>): Promise<any> => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      const index = clients.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Client not found');
      if (updates.mobileNumber) {
        const duplicate = clients.find(c => c.mobileNumber === updates.mobileNumber && c.id !== id);
        if (duplicate) throw new Error('رقم الجوال مسجل مسبقاً لعميل آخر');
      }
      const updatedClient = {
        ...clients[index],
        ...updates,
        updatedAt: new Date().toISOString(),
        adminSeen: false
      };
      clients[index] = updatedClient;
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
      return updatedClient;
    } else {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return true;
    }
  },

  markClientAsSeen: async (id: string) => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      const index = clients.findIndex(c => c.id === id);
      if (index !== -1) {
        clients[index].adminSeen = true;
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
      }
    } else {
      await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSeen: true })
      });
    }
  },

  deleteClient: async (id: string) => {
    if (IS_DEMO_MODE) {
      let clients = StorageService.getClientsSync();
      clients = clients.filter(c => c.id !== id);
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    } else {
      await fetch(`${API_BASE_URL}/clients/${id}`, { method: 'DELETE' });
    }
  },

  checkMobileExists: async (mobile: string): Promise<boolean> => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      return clients.some(c => c.mobileNumber === mobile);
    } else {
      // In a real app, optimize this to a specific endpoint check
      // For now, fetching all clients is inefficient but compatible with structure
      const res = await fetch(`${API_BASE_URL}/clients`);
      const clients = await res.json();
      return clients.some((c: any) => c.mobileNumber === mobile);
    }
  },

  getStats: async (): Promise<Stats> => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      const totalClients = clients.length;
      const totalSystemSize = clients.reduce((acc, c) => acc + (Number(c.systemSizeKw) || 0), 0);
      const totalProjectValue = clients.reduce((acc, c) => {
        const size = Number(c.systemSizeKw) || 0;
        const price = Number(c.pricePerKw) || 0;
        return acc + (size * price);
      }, 0);
      return { totalClients, totalSystemSize, totalProjectValue };
    } else {
      const res = await fetch(`${API_BASE_URL}/stats`);
      return res.json();
    }
  },

  // Demo Sync Fallback for Stats
  getStatsSync: (): Stats => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      const totalClients = clients.length;
      const totalSystemSize = clients.reduce((acc, c) => acc + (Number(c.systemSizeKw) || 0), 0);
      const totalProjectValue = clients.reduce((acc, c) => {
        const size = Number(c.systemSizeKw) || 0;
        const price = Number(c.pricePerKw) || 0;
        return acc + (size * price);
      }, 0);
      return { totalClients, totalSystemSize, totalProjectValue };
    }
    return { totalClients: 0, totalSystemSize: 0, totalProjectValue: 0 };
  },

  getRecentActivity: async (): Promise<ClientRecord[]> => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      return clients
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
    } else {
      const res = await fetch(`${API_BASE_URL}/clients`); // Should handle sorting on backend ideal
      const clients: ClientRecord[] = await res.json();
      return clients
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
    }
  },

  // Sync wrapper for notification display
  getRecentActivitySync: (): ClientRecord[] => {
    if (IS_DEMO_MODE) {
      const clients = StorageService.getClientsSync();
      return clients
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
    }
    return [];
  }
};
