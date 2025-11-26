import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { ClientRecord, Stats } from '../types';
import { 
  Search, Filter, Download, Trash2, Edit2, X, Check, 
  Users, Zap, ChevronLeft, ChevronRight
} from 'lucide-react';

const REGIONS = ['الكل', 'الرياض', 'مكة المكرمة', 'المدينة المنورة', 'القصيم', 'الشرقية', 'عسير', 'تبوك', 'حائل', 'الحدود الشمالية', 'جازان', 'نجران', 'الباحة', 'الجوف'];

export const AdminDashboard: React.FC = () => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ totalClients: 0, totalSystemSize: 0, totalProjectValue: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('الكل');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClientRecord>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const data = await StorageService.getClients();
      setClients(data);
      const statsData = await StorageService.getStats();
      setStats(statsData);
    };
    fetchData();
  }, [refreshKey]);

  // Derived filtered data
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = 
        client.clientName.includes(searchTerm) || 
        client.mobileNumber.includes(searchTerm) ||
        client.region.includes(searchTerm);
      
      const matchesRegion = regionFilter === 'الكل' || client.region === regionFilter;

      return matchesSearch && matchesRegion;
    });
  }, [clients, searchTerm, regionFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.')) {
      await StorageService.deleteClient(id);
      setRefreshKey(prev => prev + 1);
    }
  };

  const startEdit = (client: ClientRecord) => {
    setEditingId(client.id);
    setEditForm({ ...client });
  };

  const saveEdit = async () => {
    if (editingId && editForm) {
      try {
        await StorageService.updateClient(editingId, editForm);
        setEditingId(null);
        setRefreshKey(prev => prev + 1);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleMarkAsSeen = async (client: ClientRecord) => {
    if (client.adminSeen === false) { // Explicitly check false to avoid undefined issues if any
        await StorageService.markClientAsSeen(client.id);
        // Refresh local state immediately for better UX
        setClients(prev => prev.map(c => c.id === client.id ? {...c, adminSeen: true} : c));
    }
  };

  const exportToCSV = () => {
    const headers = ['الاسم', 'الجوال', 'المنطقة', 'حجم النظام', 'السعر', 'الملاحظات', 'الموظف', 'تاريخ الإضافة'];
    const csvContent = [
      headers.join(','),
      ...filteredClients.map(c => [
        `"${c.clientName}"`,
        `"${c.mobileNumber}"`,
        `"${c.region}"`,
        c.systemSizeKw,
        c.pricePerKw,
        `"${c.lastUpdateNote}"`,
        `"${c.employeeName}"`,
        `"${new Date(c.createdAt).toLocaleDateString('ar-EG')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `solar_clients_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">إجمالي العملاء</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.totalClients}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-full text-blue-600 dark:text-blue-400">
            <Users className="w-8 h-8" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">إجمالي حجم الأنظمة (kW)</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats.totalSystemSize.toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-full text-solar-600 dark:text-yellow-400">
            <Zap className="w-8 h-8" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">إجمالي قيمة المشاريع</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
              {stats.totalProjectValue.toLocaleString()}
              <span className="text-sm font-normal text-gray-400 mr-1">ريال</span>
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-full flex items-center justify-center">
            <img 
              src="https://salogos.org/wp-content/uploads/2025/02/salogos.org-Saudi_Riyal_Symbol.svg" 
              alt="SAR" 
              className="w-8 h-8 opacity-70 dark:opacity-100 dark:invert"
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64 group">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-solar-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="بحث (الاسم، الجوال، المنطقة)..." 
              className="w-full pl-4 pr-10 py-2 bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48 group">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-solar-500 w-5 h-5" />
            <select 
              className="w-full pl-4 pr-10 py-2 bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-solar-500 outline-none appearance-none text-gray-800 dark:text-white transition-colors"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        
        <button 
          onClick={exportToCSV}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-solar-600 to-solar-500 hover:from-solar-700 hover:to-solar-600 text-white px-6 py-2 rounded-lg transition-all shadow-md shadow-solar-600/20"
        >
          <Download className="w-4 h-4" />
          تصدير Excel/CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 font-medium border-b dark:border-slate-700">
              <tr>
                <th className="p-4">اسم العميل</th>
                <th className="p-4">رقم الجوال</th>
                <th className="p-4">المنطقة</th>
                <th className="p-4">الحجم (kW)</th>
                <th className="p-4">السعر</th>
                <th className="p-4 w-1/4">آخر تحديث</th>
                <th className="p-4">الموظف</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">لا توجد سجلات مطابقة</td>
                </tr>
              ) : (
                paginatedClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    {editingId === client.id ? (
                      // Edit Mode
                      <>
                        <td className="p-2"><input className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded" value={editForm.clientName} onChange={e => setEditForm({...editForm, clientName: e.target.value})} /></td>
                        <td className="p-2"><input className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded" value={editForm.mobileNumber} onChange={e => setEditForm({...editForm, mobileNumber: e.target.value})} /></td>
                        <td className="p-2">
                           <select className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded" value={editForm.region} onChange={e => setEditForm({...editForm, region: e.target.value})}>
                             {REGIONS.filter(r => r !== 'الكل').map(r => <option key={r} value={r}>{r}</option>)}
                           </select>
                        </td>
                        <td className="p-2"><input type="number" className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded" value={editForm.systemSizeKw} onChange={e => setEditForm({...editForm, systemSizeKw: Number(e.target.value)})} /></td>
                        <td className="p-2"><input type="number" className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded" value={editForm.pricePerKw} onChange={e => setEditForm({...editForm, pricePerKw: Number(e.target.value)})} /></td>
                        <td className="p-2"><textarea className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-sm" rows={1} value={editForm.lastUpdateNote} onChange={e => setEditForm({...editForm, lastUpdateNote: e.target.value})} /></td>
                        <td className="p-4 text-gray-400 text-sm">{client.employeeName}</td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={saveEdit} className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded"><Check className="w-5 h-5" /></button>
                            <button onClick={cancelEdit} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 p-1 rounded"><X className="w-5 h-5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{client.clientName}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400 dir-ltr text-right">{client.mobileNumber}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400"><span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">{client.region}</span></td>
                        <td className="p-4 text-gray-600 dark:text-gray-400 font-mono">{client.systemSizeKw}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400 font-mono">{client.pricePerKw.toLocaleString()}</td>
                        <td 
                          className={`p-4 text-sm text-gray-500 dark:text-gray-500 truncate max-w-xs transition-colors duration-300 ${client.adminSeen === false ? 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10' : ''}`}
                          title={client.adminSeen === false ? "انقر لوضع علامة تمت الرؤية" : client.lastUpdateNote}
                          onClick={() => handleMarkAsSeen(client)}
                        >
                          <div className="flex items-center gap-2">
                             {client.adminSeen === false && (
                               <span className="relative flex h-2 w-2 flex-shrink-0" title="تحديث غير مقروء">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                               </span>
                             )}
                             <span className={`truncate ${client.adminSeen === false ? 'font-semibold text-gray-800 dark:text-gray-200' : ''}`}>{client.lastUpdateNote}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-500">{client.employeeName}</td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => startEdit(client)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition-colors" title="تعديل">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(client.id)} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded transition-colors" title="حذف">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {filteredClients.length > 0 && (
          <div className="p-4 border-t dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-700/30">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              عرض {Math.min((currentPage - 1) * itemsPerPage + 1, filteredClients.length)} إلى {Math.min(currentPage * itemsPerPage, filteredClients.length)} من {filteredClients.length} سجل
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border dark:border-slate-600 rounded hover:bg-white dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border dark:border-slate-600 rounded hover:bg-white dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};