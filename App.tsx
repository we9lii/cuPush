import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, ClientRecord } from './types';
import { StorageService } from './services/storageService';
import { EmployeeEntry } from './components/EmployeeEntry';
import { AdminDashboard } from './components/AdminDashboard';
import { UserManagementModal } from './components/UserManagementModal';
import { Sun, Moon, LogOut, Code, Shield, Bell, Settings, Clock, Activity, User as UserIcon, Lock, Server } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  
  // Login State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // UI States
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light'; 
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ClientRecord[]>([]);

  // Refs for click outside
  const notifRef = useRef<HTMLDivElement>(null);

  // Handle Theme Toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const storedUser = StorageService.getCurrentUser();
    if (storedUser) setUser(storedUser);

    // Click outside listener for notifications
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update recent activity when opening notifications
  useEffect(() => {
    const fetchActivity = async () => {
        if (showNotifications && user?.role === UserRole.ADMIN) {
            // Support both Sync (Demo) and Async (API)
            if (StorageService.isDemo) {
                setRecentActivity(StorageService.getRecentActivitySync());
            } else {
                const activity = await StorageService.getRecentActivity();
                setRecentActivity(activity);
            }
        }
    };
    fetchActivity();
  }, [showNotifications, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    
    if (!usernameInput || !passwordInput) {
        setLoginError('الرجاء إدخال اسم المستخدم وكلمة المرور');
        setIsLoading(false);
        return;
    }

    try {
        const loggedInUser = await StorageService.login(usernameInput, passwordInput);
        if (loggedInUser) {
            setUser(loggedInUser);
            setLoginError('');
            setPasswordInput('');
        } else {
            setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
    } catch (err) {
        setLoginError('حدث خطأ في الاتصال بالخادم');
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
    StorageService.logout();
    setUser(null);
    setUsernameInput('');
    setPasswordInput('');
    setShowNotifications(false);
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-solar-50 via-white to-agri-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 transition-colors duration-300">
        
        {/* Theme Toggle for Login Screen */}
        <button 
          onClick={toggleTheme}
          className="absolute top-4 left-4 p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all text-gray-600 dark:text-yellow-400"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/50 dark:border-slate-700 backdrop-blur-sm transition-colors duration-300 relative overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-solar-500 to-agri-500"></div>

          <div className="flex justify-center mb-6">
             <img src="https://www2.0zz0.com/2025/11/25/07/250329265.png" alt="Company Logo" className="h-28 object-contain drop-shadow-xl" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">إدارة العملاء للمشاريع الزراعية</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">سجل دخولك لإدارة البيانات</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم</label>
              <div className="relative">
                  <UserIcon className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    className="w-full border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg p-3 pr-10 border focus:ring-2 focus:ring-agri-500 focus:border-agri-500 transition-all text-left dir-ltr shadow-sm placeholder-gray-400"
                    placeholder="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور</label>
              <div className="relative">
                  <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="password" 
                    className="w-full border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg p-3 pr-10 border focus:ring-2 focus:ring-agri-500 focus:border-agri-500 transition-all text-left dir-ltr shadow-sm placeholder-gray-400"
                    placeholder="••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
              </div>
            </div>

            {loginError && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">{loginError}</p>}
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-agri-600 to-agri-500 hover:from-agri-700 hover:to-agri-600 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-agri-600/20 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait"
            >
              {isLoading ? 'جاري التحقق...' : 'دخول'}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-700/50 w-full flex justify-center">
             <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">تطوير فيصل النتيفي</span>
                <img src="https://www2.0zz0.com/2025/11/25/07/946914580.gif" alt="Dev Logo" className="h-5 w-5 object-contain grayscale hover:grayscale-0 transition-all" />
             </div>
          </div>
        </div>
      </div>
    );
  }

  // Define theme colors based on role
  const isAdmin = user.role === UserRole.ADMIN;
  const themeColor = isAdmin ? 'solar' : 'agri';
  const themeColorText = isAdmin ? 'text-solar-600' : 'text-agri-600';
  const themeColorTextDark = isAdmin ? 'dark:text-solar-400' : 'dark:text-agri-400';

  // Authenticated App
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
      
      {/* User Management Modal */}
      {isAdmin && (
        <UserManagementModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} />
      )}

      {/* Header */}
      <header className={`bg-white dark:bg-slate-800 shadow-sm border-b ${isAdmin ? 'border-solar-100 dark:border-solar-900/30' : 'border-gray-200 dark:border-slate-700'} sticky top-0 z-50 transition-colors duration-300`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="https://www2.0zz0.com/2025/11/25/07/250329265.png" alt="Logo" className="h-10 w-auto" />
             <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-slate-600 mx-2"></div>
             <div>
               <h1 className="hidden md:block text-lg font-bold text-gray-700 dark:text-gray-200">إدارة العملاء للمشاريع الزراعية</h1>
               <span className={`text-xs font-semibold ${themeColorText} ${themeColorTextDark}`}>
                 {isAdmin ? 'لوحة الإدارة المركزية' : 'بوابة خدمات الموظفين'}
               </span>
             </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            
            {/* Admin Tools: Notifications & Settings */}
            {isAdmin && (
              <>
                 {/* Notifications */}
                 <div className="relative" ref={notifRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-solar-50 dark:hover:bg-solar-900/20 hover:text-solar-600 dark:hover:text-solar-400 transition-colors relative"
                    title="التنبيهات"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                    <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">
                      <div className={`p-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center`}>
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">آخر النشاطات</h3>
                        <span className="text-xs text-solar-600 dark:text-solar-400">آخر 5 تحديثات</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {recentActivity.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">لا توجد تحديثات حديثة</div>
                        ) : (
                          recentActivity.map(record => (
                            <div key={record.id} className="p-3 border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{record.clientName}</span>
                                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  {new Date(record.updatedAt).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${record.createdAt === record.updatedAt ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                {record.createdAt === record.updatedAt ? 'عميل جديد' : 'تحديث بيانات'}
                                <span className="text-gray-300 dark:text-slate-600">|</span>
                                <UserRoleIcon className="w-3 h-3" /> {record.employeeName}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                 </div>

                 {/* Settings / User Management */}
                 <button 
                  onClick={() => setShowUserModal(true)}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-solar-50 dark:hover:bg-solar-900/20 hover:text-solar-600 dark:hover:text-solar-400 transition-colors"
                  title="إدارة الموظفين"
                >
                  <Settings className="w-5 h-5 animate-spin-slow-hover" />
                </button>
                <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 mx-1"></div>
              </>
            )}

            {/* Theme Toggle */}
             <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg text-gray-500 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors`}
              title={isDarkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block"></div>

            <div className="flex flex-col items-end">
              <span className={`text-sm font-bold text-gray-800 dark:text-gray-100`}>{user.name}</span>
              <span className={`text-xs flex items-center gap-1 ${themeColorText} ${themeColorTextDark}`}>
                {isAdmin ? <Shield className="w-3 h-3"/> : <UserRoleIcon className="w-3 h-3"/>}
                {isAdmin ? 'مدير النظام' : 'موظف مبيعات'}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="تسجيل خروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              {isAdmin && <Shield className={`w-6 h-6 ${themeColorText} ${themeColorTextDark}`} />}
              {!isAdmin && <UserIcon className={`w-6 h-6 ${themeColorText} ${themeColorTextDark}`} />}
              {isAdmin ? 'لوحة التحكم والتقارير' : 'إدارة العملاء'}
            </h2>
            <div className={`text-sm text-gray-500 dark:text-gray-400 font-medium bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-2`}>
              <Clock className={`w-4 h-4 ${themeColorText} ${themeColorTextDark}`} />
              {new Date().toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
        </div>
        
        {isAdmin ? (
          <AdminDashboard />
        ) : (
          <EmployeeEntry currentUser={user} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 py-6 mt-auto transition-colors duration-300">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">© 2025 مدائن المستقبل للطاقة - إدارة العملاء للمشاريع الزراعية</p>
          <div className="flex items-center gap-4">
             {StorageService.isDemo ? (
                <span className="flex items-center gap-1 text-[10px] text-orange-500 bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                    <Server className="w-3 h-3" /> وضع المعاينة (Local)
                </span>
             ) : (
                <span className="flex items-center gap-1 text-[10px] text-green-500 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full">
                    <Server className="w-3 h-3" /> متصل بالخادم
                </span>
             )}
             <div className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
                <span className="text-xs text-gray-500 dark:text-gray-400">تطوير فيصل النتيفي</span>
                <img src="https://www2.0zz0.com/2025/11/25/07/946914580.gif" alt="Dev" className="h-8 w-8 object-contain" />
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const UserRoleIcon = ({className}: {className?: string}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);