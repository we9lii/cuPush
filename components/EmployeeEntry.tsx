import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { User, ClientRecord } from '../types';
import { Save, AlertCircle, CheckCircle, Smartphone, MapPin, Zap, FileText, User as UserIcon, List, Edit, X, RefreshCw, ChevronDown } from 'lucide-react';

interface Props {
  currentUser: User;
}

const REGIONS = ['الرياض', 'مكة المكرمة', 'المدينة المنورة', 'القصيم', 'الشرقية', 'عسير', 'تبوك', 'حائل', 'الحدود الشمالية', 'جازان', 'نجران', 'الباحة', 'الجوف'];

export const EmployeeEntry: React.FC<Props> = ({ currentUser }) => {
  const [formData, setFormData] = useState({
    clientName: '',
    mobileNumber: '',
    region: REGIONS[0],
    systemSizeKw: '',
    pricePerKw: '',
    lastUpdateNote: ''
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  
  // State for My Clients List & Editing
  const [myClients, setMyClients] = useState<ClientRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Accordion State
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  // Load clients on mount and after updates
  useEffect(() => {
    const loadClients = async () => {
      const allClients = await StorageService.getClients();
      const employeeClients = allClients
        .filter(c => c.employeeId === currentUser.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); // Newest first
      setMyClients(employeeClients);
    };
    loadClients();
  }, [currentUser.id, refreshKey]);

  const handleMobileBlur = async () => {
    if (formData.mobileNumber) {
        // If editing, we ignore conflict with self
        if (isEditing && editingId) {
             const allClients = await StorageService.getClients();
             const conflict = allClients.find(c => c.mobileNumber === formData.mobileNumber && c.id !== editingId);
             if (conflict) {
                 setMobileError('رقم الجوال مسجل مسبقاً لعميل آخر!');
             } else {
                 setMobileError(null);
             }
        } else {
            // New record
            const exists = await StorageService.checkMobileExists(formData.mobileNumber);
            if (exists) {
                setMobileError('رقم الجوال مسجل مسبقاً في النظام!');
            } else {
                setMobileError(null);
            }
        }
    }
  };

  const handleEditClick = (client: ClientRecord) => {
    setFormData({
        clientName: client.clientName,
        mobileNumber: client.mobileNumber,
        region: client.region,
        systemSizeKw: client.systemSizeKw.toString(),
        pricePerKw: client.pricePerKw.toString(),
        lastUpdateNote: client.lastUpdateNote
    });
    setEditingId(client.id);
    setIsEditing(true);
    setIsFormExpanded(true); // Automatically expand the form
    setMessage(null);
    setMobileError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetForm();
    setMessage(null);
  };

  const resetForm = () => {
    setFormData({
        clientName: '',
        mobileNumber: '',
        region: REGIONS[0],
        systemSizeKw: '',
        pricePerKw: '',
        lastUpdateNote: ''
    });
    setIsEditing(false);
    setEditingId(null);
    setMobileError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation
    if (mobileError) return;

    try {
      if (isEditing && editingId) {
        // UPDATE MODE
        await StorageService.updateClient(editingId, {
            clientName: formData.clientName,
            mobileNumber: formData.mobileNumber,
            region: formData.region,
            systemSizeKw: Number(formData.systemSizeKw),
            pricePerKw: Number(formData.pricePerKw),
            lastUpdateNote: formData.lastUpdateNote
        });
        setMessage({ type: 'success', text: 'تم تحديث بيانات العميل بنجاح!' });
      } else {
        // CREATE MODE
        const exists = await StorageService.checkMobileExists(formData.mobileNumber);
        if (exists) {
            setMobileError('لا يمكن الحفظ: رقم الجوال مكرر');
            return;
        }

        await StorageService.addClient({
            clientName: formData.clientName,
            mobileNumber: formData.mobileNumber,
            region: formData.region,
            systemSizeKw: Number(formData.systemSizeKw),
            pricePerKw: Number(formData.pricePerKw),
            lastUpdateNote: formData.lastUpdateNote,
            employeeId: currentUser.id,
            employeeName: currentUser.name
        });
        setMessage({ type: 'success', text: 'تم إضافة العميل الجديد بنجاح!' });
      }

      resetForm();
      setRefreshKey(prev => prev + 1); // Reload list
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 space-y-8">
      
      {/* Form Section (Collapsible Accordion) */}
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div 
            onClick={() => setIsFormExpanded(!isFormExpanded)}
            className={`p-6 text-white flex justify-between items-center cursor-pointer select-none transition-all ${isEditing ? 'bg-gradient-to-r from-blue-600 to-blue-500' : 'bg-gradient-to-r from-agri-600 to-agri-500 hover:from-agri-500 hover:to-agri-600'}`}
        >
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {isEditing ? <RefreshCw className="w-6 h-6 animate-spin-slow" /> : <FileText className="w-6 h-6" />}
              {isEditing ? 'تحديث بيانات العميل' : 'تسجيل عميل جديد'}
            </h2>
            <p className="text-white/80 mt-1 text-sm transition-opacity duration-300">
              {isFormExpanded 
                ? (isEditing ? 'قم بتعديل البيانات أو إضافة ملاحظة جديدة' : 'أدخل بيانات العميل بدقة للمتابعة')
                : 'اضغط هنا لفتح النموذج وتسجيل بيانات عميل جديد...'
              }
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
                <span className="text-xs text-white/80 block mb-1">الموظف المسجل</span>
                <span className="font-semibold flex items-center gap-1">
                <UserIcon className="w-4 h-4" /> {currentUser.name}
                </span>
            </div>
            <ChevronDown className={`w-8 h-8 transition-transform duration-300 ${isFormExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expandable Content */}
        <div 
          className={`transition-all duration-500 ease-in-out overflow-hidden ${isFormExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
            <div className="p-8 border-t border-gray-100 dark:border-slate-700">
            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Client Name */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم العميل</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-agri-500">
                        <UserIcon className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        required
                        className="block w-full pr-10 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-agri-500 focus:border-agri-500 py-3 border shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="الاسم الثلاثي"
                        value={formData.clientName}
                        onChange={e => setFormData({...formData, clientName: e.target.value})}
                    />
                    </div>
                </div>

                {/* Mobile Number */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الجوال</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-agri-500">
                        <Smartphone className="w-5 h-5" />
                    </div>
                    <input
                        type="tel"
                        required
                        pattern="[0-9]{10}"
                        className={`block w-full pr-10 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg py-3 border shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500 ${mobileError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-slate-600 focus:ring-agri-500 focus:border-agri-500'}`}
                        placeholder="05xxxxxxxx"
                        value={formData.mobileNumber}
                        onChange={e => {
                            setFormData({...formData, mobileNumber: e.target.value});
                            if(mobileError) setMobileError(null);
                        }}
                        onBlur={handleMobileBlur}
                    />
                    </div>
                    {mobileError && <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {mobileError}</p>}
                </div>

                {/* Region */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المنطقة</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-agri-500">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <select
                        className="block w-full pr-10 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-agri-500 focus:border-agri-500 py-3 border shadow-sm transition-all appearance-none"
                        value={formData.region}
                        onChange={e => setFormData({...formData, region: e.target.value})}
                    >
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    </div>
                </div>

                {/* System Size */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حجم النظام (كيلوواط)</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-agri-500">
                        <Zap className="w-5 h-5" />
                    </div>
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        required
                        className="block w-full pr-10 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-agri-500 focus:border-agri-500 py-3 border shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="مثال: 50"
                        value={formData.systemSizeKw}
                        onChange={e => setFormData({...formData, systemSizeKw: e.target.value})}
                    />
                    </div>
                </div>

                {/* Price */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">سعر الكيلوواط (غير شامل الضريبة)</label>
                    <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-agri-500">
                        <img 
                        src="https://salogos.org/wp-content/uploads/2025/02/salogos.org-Saudi_Riyal_Symbol.svg" 
                        alt="SAR" 
                        className="w-5 h-5 opacity-60 dark:invert"
                        />
                    </div>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className="block w-full pr-10 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-agri-500 focus:border-agri-500 py-3 border shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="مثال: 1100"
                        value={formData.pricePerKw}
                        onChange={e => setFormData({...formData, pricePerKw: e.target.value})}
                    />
                    </div>
                </div>

                {/* Notes */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">آخر تحديث / ملاحظات</label>
                    <textarea
                    rows={3}
                    className="block w-full bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-agri-500 focus:border-agri-500 p-3 border shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="سجّل آخر تحديثات / ملاحظات المشروع هنا..."
                    value={formData.lastUpdateNote}
                    onChange={e => setFormData({...formData, lastUpdateNote: e.target.value})}
                    ></textarea>
                </div>

                </div>

                <div className="pt-4 flex gap-4">
                <button
                    type="submit"
                    disabled={!!mobileError}
                    className={`flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-lg font-medium text-white transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${isEditing ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-blue-600/30' : 'bg-gradient-to-r from-agri-600 to-agri-500 hover:from-agri-700 hover:to-agri-600 shadow-agri-600/30'}`}
                >
                    {isEditing ? <RefreshCw className="ml-2 w-5 h-5" /> : <Save className="ml-2 w-5 h-5" />}
                    {isEditing ? 'حفظ التعديلات' : 'حفظ بيانات العميل'}
                </button>
                
                {isEditing && (
                    <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-3 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                    <X className="w-5 h-5" />
                    </button>
                )}
                </div>
            </form>
            </div>
        </div>
      </div>

      {/* My Clients List Section */}
      <div className="bg-white dark:bg-slate-800 shadow-lg rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <List className="w-5 h-5 text-agri-500" />
                قائمة عملائي المسجلين
            </h3>
            <span className="bg-agri-50 dark:bg-agri-900/30 text-agri-600 dark:text-agri-400 px-3 py-1 rounded-full text-sm font-bold">
                {myClients.length} عميل
            </span>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-right">
                <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 text-sm">
                    <tr>
                        <th className="p-4">الاسم</th>
                        <th className="p-4">الجوال</th>
                        <th className="p-4">المنطقة</th>
                        <th className="p-4">الحجم (kW)</th>
                        <th className="p-4 w-1/4">آخر ملاحظة</th>
                        <th className="p-4 text-center">تحديث</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">
                    {myClients.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-400 dark:text-gray-500">
                                لم تقم بتسجيل أي عملاء بعد.
                            </td>
                        </tr>
                    ) : (
                        myClients.map(client => (
                            <tr key={client.id} className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/30 transition-colors ${editingId === client.id ? 'bg-blue-50 dark:bg-slate-700/50' : ''}`}>
                                <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{client.clientName}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-400 dir-ltr text-right font-mono">{client.mobileNumber}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">{client.region}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">{client.systemSizeKw}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400 truncate max-w-xs" title={client.lastUpdateNote}>
                                    {client.lastUpdateNote}
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleEditClick(client)}
                                        className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 p-2 rounded-full transition-colors"
                                        title="تحديث البيانات"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};