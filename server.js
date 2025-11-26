const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: 'https://qcheck.qssun.solar',
    credentials: true
}));
app.use(express.json());

// --- Middleware للتحقق من الأخطاء ---
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Auth Routes ---

// تسجيل الدخول
app.post('/api/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // 1. البحث عن المستخدم
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

    if (users.length === 0) {
        return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const user = users[0];

    // 2. التحقق من كلمة المرور
    // ملاحظة: في بداية المشروع قد تكون كلمات المرور غير مشفرة، لذا ندعم الحالتين
    const isMatch = await bcrypt.compare(password, user.password_hash);
    const isPlainMatch = password === user.password_hash; // للتوافق مع البيانات القديمة

    if (!isMatch && !isPlainMatch) {
        return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // إزالة كلمة المرور من الرد
    delete user.password_hash;

    res.json(user);
}));

// --- Users Routes (Admin Only) ---
app.get('/api/users', asyncHandler(async (req, res) => {
    const [rows] = await db.query('SELECT id, username, full_name as name, role FROM users');
    res.json(rows);
}));

app.post('/api/users', asyncHandler(async (req, res) => {
    const { username, password, name, role } = req.body;

    // التحقق من التكرار
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
        return res.status(400).json({ message: 'اسم المستخدم موجود مسبقاً' });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, name, role]
    );

    res.json({ id: result.insertId, username, name, role });
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
}));

// --- Clients Routes ---

// جلب كل العملاء
app.get('/api/clients', asyncHandler(async (req, res) => {
    // نجلب أيضاً اسم الموظف عبر الـ JOIN
    const query = `
        SELECT c.*, u.full_name as employeeName 
        FROM clients c 
        LEFT JOIN users u ON c.employee_id = u.id
        ORDER BY c.updated_at DESC
    `;
    const [rows] = await db.query(query);

    // تنسيق البيانات لتطابق الواجهة الأمامية (camelCase)
    const formatted = rows.map(row => ({
        id: row.id,
        clientName: row.client_name,
        mobileNumber: row.mobile_number,
        region: row.region,
        systemSizeKw: row.system_size_kw,
        pricePerKw: row.price_per_kw,
        lastUpdateNote: row.last_update_note,
        employeeId: row.employee_id,
        employeeName: row.employeeName || 'غير معروف',
        adminSeen: Boolean(row.admin_seen),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));

    res.json(formatted);
}));

// إضافة عميل
app.post('/api/clients', asyncHandler(async (req, res) => {
    const { clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, employeeId } = req.body;

    // التحقق من تكرار الجوال
    const [existing] = await db.query('SELECT id FROM clients WHERE mobile_number = ?', [mobileNumber]);
    if (existing.length > 0) {
        return res.status(400).json({ message: 'رقم الجوال مسجل مسبقاً' });
    }

    const [result] = await db.query(
        `INSERT INTO clients 
        (client_name, mobile_number, region, system_size_kw, price_per_kw, last_update_note, employee_id, admin_seen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, employeeId, false]
    );

    res.json({ id: result.insertId, message: 'تمت الإضافة بنجاح' });
}));

// تحديث عميل
app.put('/api/clients/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    // نتجاهل الحقول التي لا نريد تحديثها، أو نستخدم dynamic query
    // هنا سنحدث الحقول المرسلة فقط

    // إذا كان التحديث لمجرد "adminSeen"
    if (req.body.adminSeen !== undefined && Object.keys(req.body).length === 1) {
        await db.query('UPDATE clients SET admin_seen = ? WHERE id = ?', [req.body.adminSeen, id]);
        return res.json({ message: 'Updated seen status' });
    }

    const { clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote } = req.body;

    // التحقق من تكرار الجوال لغير هذا العميل
    if (mobileNumber) {
        const [existing] = await db.query('SELECT id FROM clients WHERE mobile_number = ? AND id != ?', [mobileNumber, id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'رقم الجوال مسجل لعميل آخر' });
        }
    }

    await db.query(
        `UPDATE clients SET 
        client_name = ?, mobile_number = ?, region = ?, system_size_kw = ?, price_per_kw = ?, last_update_note = ?, admin_seen = ?
        WHERE id = ?`,
        [clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, false, id] // نعيد admin_seen لـ false عند التحديث
    );

    res.json({ message: 'Updated successfully' });
}));

// حذف عميل
app.delete('/api/clients/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
}));

// --- Stats Route ---
app.get('/api/stats', asyncHandler(async (req, res) => {
    const [clients] = await db.query('SELECT system_size_kw, price_per_kw FROM clients');

    const totalClients = clients.length;
    const totalSystemSize = clients.reduce((acc, c) => acc + Number(c.system_size_kw), 0);
    const totalProjectValue = clients.reduce((acc, c) => acc + (Number(c.system_size_kw) * Number(c.price_per_kw)), 0);

    res.json({
        totalClients,
        totalSystemSize,
        totalProjectValue
    });
}));

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});