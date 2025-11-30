import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storageService';
import { X, UserPlus, Trash2, Shield, User as UserIcon, Lock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    const data = await StorageService.getUsers();
    setUsers(data);
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setError(null);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole(UserRole.EMPLOYEE);
    }
  }, [isOpen]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserUsername || !newUserPassword) return;

    try {
      await StorageService.addUser({
        username: newUserUsername,
        password: newUserPassword,
        name: newUserName,
        role: newUserRole
      });
      loadUsers();
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole(UserRole.EMPLOYEE);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await StorageService.deleteUser(id);
        loadUsers();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-solar-100 dark:border-slate-600">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-solar-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-solar-600" />
              إدارة المستخدمين والصلاحيات
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إضافة وحذف الموظفين والمشرفين من النظام</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Add User Form */}
          <div className="bg-white dark:bg-slate-700/30 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2 text-solar-600 dark:text-solar-400">
              <UserPlus className="w-4 h-4" />
              إضافة مستخدم جديد
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">الاسم الكامل</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثال: خالد عبدالله"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white transition-all"
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">اسم المستخدم (للدخول)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثال: emp3"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white dir-ltr text-left transition-all"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute right-2 top-2.5 w-3 h-3 text-gray-400" />
                    <input 
                        type="password" 
                        required
                        placeholder="••••••"
                        className="w-full px-3 py-2 pr-7 bg-gray-50 dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white dir-ltr text-left transition-all"
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">الدور (الصلاحية)</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white appearance-none transition-all"
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                  >
                      <option value={UserRole.EMPLOYEE}>موظف</option>
                      <option value={UserRole.EDITOR}>محرّر</option>
                      <option value={UserRole.ADMIN}>مشرف</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="w-full md:w-auto px-6 py-2 bg-solar-600 hover:bg-solar-700 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-solar-600/20"
                >
                  حفظ وإضافة
                </button>
              </div>
            </form>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>

          {/* Users List */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">قائمة المستخدمين ({users.length})</h3>
            <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="p-3 font-medium">الاسم</th>
                    <th className="p-3 font-medium">اسم المستخدم</th>
                    <th className="p-3 font-medium">الدور</th>
                    <th className="p-3 font-medium text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                  {users.map(user => (
                    <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="p-3 text-gray-800 dark:text-gray-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-full ${user.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'} dark:bg-slate-700`}>
                            <UserIcon className="w-3 h-3" />
                          </div>
                          {user.name}
                        </div>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 dir-ltr text-right font-mono text-xs">{user.username}</td>
                      <td className="p-3">
                        <span className={
                          `text-xs px-2 py-0.5 rounded-full ` +
                          (user.role === UserRole.ADMIN
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : user.role === UserRole.EDITOR
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')
                        }>
                          {user.role === UserRole.ADMIN ? 'مشرف' : user.role === UserRole.EDITOR ? 'محرّر' : 'موظف'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {(user.username !== 'admin' && user.id !== StorageService.getCurrentUser()?.id) && (
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="حذف المستخدم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
