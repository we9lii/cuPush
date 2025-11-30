import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StorageService } from '../services/storageService';
import { ClientRecord, User, UserRole } from '../types';
import { Workbook } from 'exceljs';
import {
  Search, Download, Trash2, Edit2, X, Check,
  Users, Zap, ChevronLeft, ChevronRight, Eye, ChevronDown, User as UserIcon, Copy, ExternalLink, Activity, MapPin
} from 'lucide-react';
import { ClientDetailsModal } from './ClientDetailsModal';

const REGIONS = ['الكل', 'الرياض', 'مكة المكرمة', 'المدينة المنورة', 'القصيم', 'الشرقية', 'عسير', 'تبوك', 'حائل', 'الحدود الشمالية', 'جازان', 'نجران', 'الباحة', 'الجوف'];

export const AdminDashboard: React.FC = () => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [excelIncludeTotals, setExcelIncludeTotals] = useState<boolean>(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isEmployeeListOpen, setIsEmployeeListOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClientRecord>>({});

  // View Details State
  const [viewClient, setViewClient] = useState<ClientRecord | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const employeeListRef = useRef<HTMLDivElement | null>(null);

  const hasActiveFilters = (searchTerm.trim() !== '') || !!selectedEmployeeId;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientsData, usersData] = await Promise.all([
          StorageService.getClients(),
          StorageService.getUsers()
        ]);
        setClients(clientsData);
        setUsers(usersData.map(u => ({ ...u, id: String(u.id), role: String(u.role).toUpperCase() })));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isEmployeeListOpen && employeeListRef.current && !employeeListRef.current.contains(e.target as Node)) {
        setIsEmployeeListOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (isEmployeeListOpen && e.key === 'Escape') setIsEmployeeListOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isEmployeeListOpen]);

  // Derived filtered data
  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const selectedUserName = selectedEmployeeId ? users.find(u => u.id === selectedEmployeeId)?.name : undefined;
    return clients.filter(client => {
      const wellsStr = String(client.wellsCount ?? '').toLowerCase();
      const name = (client.clientName || '').toLowerCase();
      const mobile = (client.mobileNumber || '').toLowerCase();
      const region = (client.region || '').toLowerCase();
      const matchesSearch = term === '' ? true : (
        name.includes(term) ||
        mobile.includes(term) ||
        region.includes(term) ||
        wellsStr.includes(term)
      );
      const matchesEmployee = !selectedEmployeeId || client.employeeId === selectedEmployeeId || (!!selectedUserName && client.employeeName === selectedUserName);

      return matchesSearch && matchesEmployee;
    });
  }, [clients, searchTerm, selectedEmployeeId]);

  // Sort by employee name (Arabic locale) for display and export
  const sortedClients = useMemo(() => {
    const list = [...filteredClients];
    list.sort((a, b) => {
      const ea = a.employeeName || '';
      const eb = b.employeeName || '';
      return ea.localeCompare(eb, 'ar', { sensitivity: 'base' });
    });
    return list;
  }, [filteredClients]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const paginatedClients = sortedClients.slice(
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

  const toShortMapUrl = (url: string): string => {
    try {
      const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m) return `https://www.google.com/maps?q=${m[1]},${m[2]}`;
      const m2 = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m2) return `https://www.google.com/maps?q=${m2[1]},${m2[2]}`;
    } catch { }
    return url;
  };

  const handleMarkAsSeen = async (client: ClientRecord) => {
    if (client.adminSeen === false) {
      await StorageService.markClientAsSeen(client.id);
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, adminSeen: true } : c));
    }
  };

  const exportToCSV = () => {
    const sep = ',';
    const esc = (v: any) => {
      if (v === null || v === undefined) return '""';
      const s = String(v).replace(/\"/g, '\"\"');
      return `"${s}"`;
    };
    // Updated Headers and Data Mapping
    const headers = ['اسم العميل', 'رقم الجوال', 'المنطقة', 'الحجم (حصان)', 'عدد الآبار', 'آخر تحديث', 'موقع المشروع', 'السعر', 'الموظف', 'تاريخ الإضافة'];
    const rows = sortedClients.map(c => [
      esc(c.clientName),
      esc(c.mobileNumber),
      esc(c.region),
      (c.systemSizeHp ?? ''),
      (c.wellsCount ?? ''),
      esc(c.lastUpdateNote ?? ''),
      esc(c.projectMapUrl ?? ''),
      (c.pricePerHp ?? ''),
      esc(c.employeeName ?? ''),
      esc(new Date(c.createdAt).toLocaleDateString('ar-EG'))
    ].join(sep));
    const csvContent = [
      `sep=${sep}`,
      headers.join(sep),
      ...rows
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `solar_clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const EXPORT_TEMPLATE = {
    meta: {
      font: { name: 'Cairo', size: 8, color: '#000000' },
      direction: 'rtl',
      header: { backgroundColor: '#4472C4', fontColor: '#FFFFFF', fontWeight: 'bold', alignment: 'center' },
      cellBorder: { style: 'thin', color: '#CCCCCC' },
      cellAlignment: 'right'
    },
    columns: [
      { key: 'اسم العميل', title: 'اسم العميل', type: 'string', align: 'right' },
      { key: 'رقم الجوال', title: 'رقم الجوال', type: 'string', align: 'center' },
      { key: 'المنطقة', title: 'المنطقة', type: 'string', align: 'right' },
      { key: 'الحجم (حصان)', title: 'الحجم (حصان)', type: 'number', align: 'center' },
      { key: 'عدد الآبار', title: 'عدد الآبار', type: 'number', align: 'center' },
      { key: 'آخر تحديث', title: 'آخر تحديث', type: 'string', align: 'center' },
      { key: 'موقع المشروع', title: 'موقع المشروع', type: 'string', align: 'right' },
      { key: 'السعر', title: 'السعر', type: 'number', align: 'center' },
      { key: 'الموظف', title: 'الموظف', type: 'string', align: 'right' }
    ]
  } as const;

  const hexToARGB = (hex: string) => {
    const h = hex.replace('#', '');
    return ('FF' + h.toUpperCase());
  };

  const alignMap = (a?: string): 'left' | 'center' | 'right' => (a === 'center' ? 'center' : (a === 'left' ? 'left' : 'right'));

  const exportToExcel = async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('العملاء', { views: [{ rightToLeft: EXPORT_TEMPLATE.meta.direction === 'rtl' }] });

    const headerTitles = EXPORT_TEMPLATE.columns.map(c => c.title);
    const headerRow = ws.addRow(headerTitles);
    headerRow.height = 20;
    headerRow.eachCell(cell => {
      cell.font = { name: EXPORT_TEMPLATE.meta.font.name, size: EXPORT_TEMPLATE.meta.font.size, bold: true, color: { argb: hexToARGB(EXPORT_TEMPLATE.meta.header.fontColor) } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToARGB(EXPORT_TEMPLATE.meta.header.backgroundColor) } };
      cell.border = {
        top: { style: 'thin', color: { argb: hexToARGB(EXPORT_TEMPLATE.meta.cellBorder.color) } },
        right: { style: 'thin', color: { argb: hexToARGB(EXPORT_TEMPLATE.meta.cellBorder.color) } },
        bottom: { style: 'thin', color: { argb: hexToARGB(EXPORT_TEMPLATE.meta.cellBorder.color) } },
        left: { style: 'thin', color: { argb: hexToARGB(EXPORT_TEMPLATE.meta.cellBorder.color) } }
      };
    });

    const toCellValueByKey = (colKey: string, c: ClientRecord) => {
      switch (colKey) {
        case 'اسم العميل': return c.clientName;
        case 'رقم الجوال': return c.mobileNumber;
        case 'المنطقة': return c.region;
        case 'الحجم (حصان)': return c.systemSizeHp ?? '';
        case 'عدد الآبار': return c.wellsCount ?? '';
        case 'موقع المشروع': return (c.projectMapUrl ?? '');
        case 'السعر': return c.pricePerHp ?? '';
        case 'آخر تحديث': return c.lastUpdateNote ?? '';
        case 'الموظف': return c.employeeName ?? '';
        default: return '';
      }
    };

    const groups = new Map<string, ClientRecord[]>();
    sortedClients.forEach(c => {
      const k = c.employeeName || 'غير معروف';
      const arr = groups.get(k) || [];
      arr.push(c);
      groups.set(k, arr);
    });
    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
    keys.forEach(k => {
      const list = groups.get(k) || [];
      list.forEach(c => {
        const vals = EXPORT_TEMPLATE.columns.map(col => toCellValueByKey(col.key, c));
        const row = ws.addRow(vals);
        row.height = 18;
        row.eachCell((cell, colNumber) => {
          const meta = EXPORT_TEMPLATE.meta;
          const col = EXPORT_TEMPLATE.columns[colNumber - 1];
          cell.font = { name: meta.font.name, size: meta.font.size, color: { argb: hexToARGB(meta.font.color) } };
          const shouldWrap = col.key === 'آخر تحديث' || col.key === 'اسم العميل' || col.key === 'موقع المشروع';
          cell.alignment = { horizontal: alignMap(col.align || meta.cellAlignment), vertical: 'middle', wrapText: shouldWrap, indent: 1 };
          cell.border = {
            top: { style: 'thin', color: { argb: hexToARGB(meta.cellBorder.color) } },
            right: { style: 'thin', color: { argb: hexToARGB(meta.cellBorder.color) } },
            bottom: { style: 'thin', color: { argb: hexToARGB(meta.cellBorder.color) } },
            left: { style: 'thin', color: { argb: hexToARGB(meta.cellBorder.color) } }
          };
          if (col.type === 'number') {
            cell.numFmt = '0';
          }
        });
      });
      ws.addRow([]);
    });

    const widths = [32, 18, 16, 12, 12, 45, 55, 12, 18];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `solar_clients_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full px-4 py-8 space-y-8">

      {viewClient && (
        <ClientDetailsModal
          client={viewClient}
          onClose={() => setViewClient(null)}
        />
      )}

      {/* Stats Cards - Reduced to only Total Clients */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between transition-colors duration-300">
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">إجمالي العملاء</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{clients.length}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-full text-blue-600 dark:text-blue-400">
            <Users className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Employee Filter Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-solar-600" />
              قائمة الموظفين والتقارير
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              اختر موظفاً لعرض عملائه وتقارير الأداء الخاصة به
            </p>
          </div>

          <div ref={employeeListRef} className="relative w-full sm:w-72" title="اختيار موظف">
            <button
              onClick={() => setIsEmployeeListOpen(!isEmployeeListOpen)}
              className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
              aria-expanded={isEmployeeListOpen}
              title="اختر موظف لعرض تقاريره"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                <span className="font-medium">
                  {selectedEmployeeId
                    ? users.find(u => u.id === selectedEmployeeId)?.name
                    : 'اختر موظف...'}
                </span>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isEmployeeListOpen ? 'rotate-180' : ''}`} />
            </button>

            {isEmployeeListOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn" role="listbox">
                <div className="max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedEmployeeId(null); setIsEmployeeListOpen(false); }}
                    className={`w-full text-right px-4 py-3 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${!selectedEmployeeId ? 'bg-solar-50 dark:bg-solar-900/20 text-solar-700 dark:text-solar-300' : 'text-gray-700 dark:text-gray-200'}`}
                    role="option"
                  >
                    <span className="font-medium">عرض الكل</span>
                    <span className="text-xs bg-gray-100 dark:bg-slate-600 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">{clients.length}</span>
                  </button>

                  {users.map(u => {
                    const count = clients.filter(c => c.employeeId === u.id || c.employeeName === u.name).length;
                    return (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedEmployeeId(String(u.id)); setIsEmployeeListOpen(false); }}
                        className={`w-full text-right px-4 py-3 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${selectedEmployeeId === u.id ? 'bg-solar-50 dark:bg-solar-900/20 text-solar-700 dark:text-solar-300' : 'text-gray-700 dark:text-gray-200'}`}
                        role="option"
                      >
                        <span>{u.name}</span>
                        <span className="text-xs bg-gray-100 dark:bg-slate-600 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEmployeeId && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
              <Zap className="w-4 h-4" />
              <span>تقرير الموظف: <b>{users.find(u => u.id === selectedEmployeeId)?.name}</b></span>
            </div>
            <button
              onClick={() => setSelectedEmployeeId(null)}
              className="text-xs text-red-500 hover:text-red-600 font-medium hover:underline"
            >
              إلغاء التصفية
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between transition-colors duration-300 sticky top-14 md:top-20 z-30">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64 group" title="بحث">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-solar-500 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              placeholder="بحث (الاسم، الجوال، المنطقة، الآبار)..."
              className="w-full pl-3 md:pl-4 pr-9 md:pr-10 py-1.5 md:py-2 bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-solar-500 outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              title="اكتب للبحث في جميع الحقول"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedEmployeeId(null); setCurrentPage(1); }}
              className="w-full md:w-auto flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-lg text-xs transition-colors"
              title="إزالة جميع عوامل التصفية"
            >
              <X className="w-3 h-3" />
              إزالة التصفية
            </button>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={exportToExcel}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-solar-600 to-solar-500 hover:from-solar-700 hover:to-solar-600 text-white px-6 py-2 rounded-lg transition-all shadow-md shadow-solar-600/20"
            title="تصدير ملف Excel منسق"
          >
            <Download className="w-4 h-4" />
            تصدير Excel
          </button>
          <select
            className="w-full md:w-auto bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white"
            title="خيارات التصدير"
            value={excelIncludeTotals ? 'withTotals' : 'detailsOnly'}
            onChange={(e) => setExcelIncludeTotals(e.target.value === 'withTotals')}
          >
            <option value="detailsOnly">تفصيلي</option>
            <option value="withTotals">تفصيلي مع المجاميع</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="overflow-x-auto md:overflow-x-visible">
          <table className="w-full text-right table-fixed min-w-[1000px] lg:min-w-full" dir="rtl">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 font-medium border-b dark:border-slate-700 text-xs md:text-sm sticky top-0 z-10">
              <tr>
                <th className="p-2 md:p-4">اسم العميل</th>
                <th className="p-2 md:p-4">رقم الجوال</th>
                <th className="p-2 md:p-4">المنطقة</th>
                <th className="p-2 md:p-4">الحجم (حصان)</th>
                <th className="p-2 md:p-4">عدد الآبار</th>
                <th className="p-2 md:p-4">آخر تحديث</th>
                <th className="p-2 md:p-4">الموقع</th>
                <th className="p-2 md:p-4">السعر</th>
                <th className="p-2 md:p-4">الموظف</th>
                <th className="p-2 md:p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/5"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/5"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div></td>
                    <td className="p-2 md:p-4"><div className="h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/5"></div></td>
                    <td className="p-2 md:p-4"><div className="h-5 md:h-6 bg-gray-200 dark:bg-slate-700 rounded w-16 mx-auto"></div></td>
                  </tr>
                ))
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text.center text-gray-500 dark:text-gray-400">لا توجد سجلات مطابقة</td>
                </tr>
              ) : (
                paginatedClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer odd:bg-white even:bg-gray-50 dark:odd:bg-slate-800 dark:even:bg-slate-800/50" title="انقر لعرض التفاصيل" onClick={() => { setViewClient(client); handleMarkAsSeen(client); }}>
                    {editingId === client.id ? (
                      // Edit Mode
                      <>
                        <td className="p-2"><input className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.clientName} onChange={e => setEditForm({ ...editForm, clientName: e.target.value })} /></td>
                        <td className="p-2"><input className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.mobileNumber} onChange={e => setEditForm({ ...editForm, mobileNumber: e.target.value })} /></td>
                        <td className="p-2">
                          <select className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.region} onChange={e => setEditForm({ ...editForm, region: e.target.value })}>
                            {REGIONS.filter(r => r !== 'الكل').map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><input type="number" className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.systemSizeHp ?? ''} onChange={e => setEditForm({ ...editForm, systemSizeHp: Number(e.target.value) })} /></td>
                        <td className="p-2"><input type="number" className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.wellsCount ?? ''} onChange={e => setEditForm({ ...editForm, wellsCount: Number(e.target.value) })} /></td>
                        <td className="p-2"><textarea className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" rows={1} value={editForm.lastUpdateNote} onChange={e => setEditForm({ ...editForm, lastUpdateNote: e.target.value })} /></td>
                        <td className="p-2"><input className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.projectMapUrl ?? ''} onChange={e => setEditForm({ ...editForm, projectMapUrl: e.target.value })} placeholder="رابط" /></td>
                        <td className="p-2"><input type="number" className="w-full border dark:border-slate-600 dark:bg-slate-700 dark:text-white p-1 rounded text-xs" value={editForm.pricePerHp} onChange={e => setEditForm({ ...editForm, pricePerHp: Number(e.target.value) })} /></td>
                        <td className="p-4 text-gray-400 text-xs">{client.employeeName}</td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={saveEdit} className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 p-1 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className={`p-2 md:p-4 text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 cursor-pointer hover:text-solar-600 dark:hover:text-solar-400 transition-colors whitespace-normal break-words ${client.adminSeen === false ? 'font-semibold' : ''}`} onClick={() => { setViewClient(client); handleMarkAsSeen(client); }}>{client.clientName}</td>
                        <td className="p-2 md:p-4 text-xs md:text-sm text-gray-600 dark:text-gray-400 dir-ltr text-right whitespace-nowrap">{client.mobileNumber}</td>
                        <td className="p-2 md:p-4 text-xs md:text-sm text-gray-600 dark:text-gray-400"><span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[10px] md:text-xs">{client.region}</span></td>
                        <td className="p-2 md:p-4 text-xs md:text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">{client.systemSizeHp ?? '-'}</td>
                        <td className="p-2 md:p-4 text-xs md:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{client.wellsCount ?? '-'}</td>
                        <td
                          className={`p-4 text-sm text-gray-500 dark:text-gray-500 whitespace-normal break-words transition-colors duration-300 ${client.adminSeen === false ? 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10' : ''}`}
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
                            <span className={`${client.adminSeen === false ? 'font-semibold text-gray-800 dark:text-gray-200' : ''}`}>{client.lastUpdateNote}</span>
                          </div>
                        </td>
                        <td className="p-2 md:p-4 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                          {client.projectMapUrl ? (
                            <div className="flex flex-col gap-1 items-center">
                              <button
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded w-full justify-center"
                                title="نسخ الرابط"
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(client.projectMapUrl!); }}
                              >
                                <Copy className="w-3 h-3" /> نسخ
                              </button>
                              <a
                                href={client.projectMapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 text-[10px] bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded w-full justify-center"
                                title="فتح الموقع"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" /> فتح
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">{client.pricePerHp?.toLocaleString()}</td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-500 whitespace-nowrap">{client.employeeName}</td>
                        <td className="p-2 md:p-3 text-center whitespace-nowrap">
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-8 h-8 rounded transition-colors" title="حذف">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
        {
          filteredClients.length > 0 && (
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
          )
        }
      </div >
    </div >
  );
};
