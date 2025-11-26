const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Middleware للتحقق من الأخطاء ---
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Initialize database on startup
(async () => {
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(15) UNIQUE`);

        await db.query(`CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            client_name VARCHAR(100) NOT NULL,
            mobile_number VARCHAR(15) UNIQUE NOT NULL,
            region VARCHAR(100),
            system_size_kw DECIMAL(10, 2),
            price_per_kw DECIMAL(10, 2),
            last_update_note TEXT,
            employee_id INTEGER REFERENCES users(id),
            admin_seen BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        const hashedPassword = await bcrypt.hash('123', 10);
        await db.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
             VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
            ['admin', hashedPassword, 'المشرف العام', 'admin']
        );
        console.log('✅ Database initialized');
    } catch (error) {
        console.error('❌ DB init error:', error);
    }
})();

// --- Auth Routes ---

// تسجيل الدخول
app.post('/api/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    // 1. البحث عن المستخدم
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
        return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const user = result.rows[0];

    // 2. التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // 3. تحضير البيانات للإرجاع - تحويل full_name إلى name
    const { password_hash, full_name, created_at, ...userData } = user;

    res.json({
        ...userData,
        name: full_name,
        role: user.role.toUpperCase()
    });
}));

// --- Root Page ---
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Running By Faisal</title>
  <link rel="stylesheet" href="css/term.css">
  <style>
    body{margin:0;background:#0c1022;color:#02d1ff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu,'Fira Sans',sans-serif}
    .container.on{display:flex;align-items:center;justify-content:center;height:100vh}
    .screen{max-width:720px;width:100%;padding:24px}
    .title{letter-spacing:.12em;color:#0efb6e;margin:0 0 12px;font-size:14px}
    .box--outer{border:1px solid #0efb6e;padding:10px}
    .box{border:1px solid #02d1ff;padding:10px}
    .box--inner{border:1px dashed #02d1ff;padding:14px}
    .holder{font-size:18px}
    b{color:#ffd166}
  </style>
</head>
<body class="">
  <div class="container on">
    <div class="screen">
      <h3 class="title">CONNECTION ESTABLISHED</h3>
      <div class="box--outer">
        <div class="box">
          <div class="box--inner">
            <div class="content">
              <div class="holder">
                <b>Welcome to Faisal world</b> — &nbsp;&nbsp;API Running
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
});

// --- Users Routes (Admin Only) ---
app.get('/api/users', asyncHandler(async (req, res) => {
    const result = await db.query('SELECT id, username, full_name as name, role, mobile_number FROM users');
    const users = result.rows.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: String(u.role).toUpperCase(),
        mobileNumber: u.mobile_number || null
    }));
    res.json(users);
}));

app.post('/api/users', asyncHandler(async (req, res) => {
    const { username, password, name, role, mobileNumber } = req.body;

    const existingResult = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingResult.rows.length > 0) {
        return res.status(400).json({ message: 'اسم المستخدم موجود مسبقاً' });
    }

    if (mobileNumber) {
        const existingMobile = await db.query('SELECT id FROM users WHERE mobile_number = $1', [mobileNumber]);
        if (existingMobile.rows.length > 0) {
            return res.status(400).json({ message: 'رقم الجوال موجود مسبقاً' });
        }
    }

    const roleLower = String(role).toLowerCase();
    if (!['admin', 'employee'].includes(roleLower)) {
        return res.status(400).json({ message: 'دور غير صالح. استخدم admin أو employee' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
        'INSERT INTO users (username, password_hash, full_name, role, mobile_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, role, mobile_number',
        [username, hashedPassword, name, roleLower, mobileNumber || null]
    );

    res.json({ id: result.rows[0].id, username, name, role: String(result.rows[0].role).toUpperCase(), mobileNumber: result.rows[0].mobile_number });
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
}));

// --- Clients Routes ---

app.get('/api/clients', asyncHandler(async (req, res) => {
    const query = `
        SELECT c.*, u.full_name as employeeName 
        FROM clients c 
        LEFT JOIN users u ON c.employee_id = u.id
        ORDER BY c.updated_at DESC
    `;
    const result = await db.query(query);

    const formatted = result.rows.map(row => ({
        id: row.id,
        clientName: row.client_name,
        mobileNumber: row.mobile_number,
        region: row.region,
        systemSizeKw: Number(row.system_size_kw),
        pricePerKw: Number(row.price_per_kw),
        lastUpdateNote: row.last_update_note,
        employeeId: row.employee_id !== null ? String(row.employee_id) : null,
        employeeName: row.employeename || 'غير معروف',
        adminSeen: Boolean(row.admin_seen),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));

    res.json(formatted);
}));

app.post('/api/clients', asyncHandler(async (req, res) => {
    const { clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, employeeId } = req.body;

    const existingResult = await db.query('SELECT id FROM clients WHERE mobile_number = $1', [mobileNumber]);
    if (existingResult.rows.length > 0) {
        return res.status(400).json({ message: 'رقم الجوال مسجل مسبقاً' });
    }

    const employeeIdInt = employeeId !== undefined && employeeId !== null ? parseInt(employeeId, 10) : null;
    const result = await db.query(
        `INSERT INTO clients 
        (client_name, mobile_number, region, system_size_kw, price_per_kw, last_update_note, employee_id, admin_seen) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, employeeIdInt, false]
    );

    res.json({ id: result.rows[0].id, message: 'تمت الإضافة بنجاح' });
}));

app.put('/api/clients/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.body.adminSeen !== undefined && Object.keys(req.body).length === 1) {
        await db.query('UPDATE clients SET admin_seen = $1 WHERE id = $2', [req.body.adminSeen, id]);
        return res.json({ message: 'Updated seen status' });
    }

    const { clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote } = req.body;

    if (mobileNumber) {
        const existingResult = await db.query('SELECT id FROM clients WHERE mobile_number = $1 AND id != $2', [mobileNumber, id]);
        if (existingResult.rows.length > 0) {
            return res.status(400).json({ message: 'رقم الجوال مسجل لعميل آخر' });
        }
    }

    await db.query(
        `UPDATE clients SET 
        client_name = $1, mobile_number = $2, region = $3, system_size_kw = $4, price_per_kw = $5, last_update_note = $6, admin_seen = $7
        WHERE id = $8`,
        [clientName, mobileNumber, region, systemSizeKw, pricePerKw, lastUpdateNote, false, id]
    );

    res.json({ message: 'Updated successfully' });
}));

app.delete('/api/clients/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
}));

// --- Stats Route ---
app.get('/api/stats', asyncHandler(async (req, res) => {
    const result = await db.query('SELECT system_size_kw, price_per_kw FROM clients');
    const clients = result.rows;

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
