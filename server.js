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
            system_size_hp DECIMAL(10, 2),
            price_per_hp DECIMAL(10, 2),
            last_update_note TEXT,
            employee_id INTEGER REFERENCES users(id),
            wells_count INTEGER,
            project_map_url TEXT,
            admin_seen BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        try { await db.query(`ALTER TABLE clients RENAME COLUMN system_size_kw TO system_size_hp`); } catch (e) {}
        try { await db.query(`ALTER TABLE clients RENAME COLUMN price_per_kw TO price_per_hp`); } catch (e) {}
        await db.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS wells_count INTEGER`);
        await db.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS project_map_url TEXT`);
        await db.query(`CREATE TABLE IF NOT EXISTS client_logs (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        systemSizeHp: Number(row.system_size_hp),
        pricePerHp: Number(row.price_per_hp),
        lastUpdateNote: row.last_update_note,
        employeeId: row.employee_id !== null ? String(row.employee_id) : null,
        employeeName: row.employeename || 'غير معروف',
        adminSeen: Boolean(row.admin_seen),
        wellsCount: row.wells_count !== null && row.wells_count !== undefined ? Number(row.wells_count) : null,
        projectMapUrl: row.project_map_url || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));

    res.json(formatted);
}));

app.post('/api/clients', asyncHandler(async (req, res) => {
    const { clientName, mobileNumber, region, systemSizeHp, pricePerHp, lastUpdateNote, employeeId, wellsCount, projectMapUrl } = req.body;

    const existingResult = await db.query('SELECT id FROM clients WHERE mobile_number = $1', [mobileNumber]);
    if (existingResult.rows.length > 0) {
        return res.status(400).json({ message: 'رقم الجوال مسجل مسبقاً' });
    }

    const employeeIdInt = employeeId !== undefined && employeeId !== null ? parseInt(employeeId, 10) : null;
    const wellsInt = wellsCount !== undefined && wellsCount !== null ? parseInt(wellsCount, 10) : null;
    if (wellsInt !== null && (Number.isNaN(wellsInt) || wellsInt < 1 || wellsInt > 100)) {
        return res.status(400).json({ message: 'عدد الآبار يجب أن يكون بين 1 و 100' });
    }
    const url = projectMapUrl || null;
    if (url !== null) {
        const isValidMap = /^https?:\/\/(www\.)?google\.(com|[a-z]{2})\/maps\//i.test(url) || /^https?:\/\/maps\.app\.goo\.gl\//i.test(url);
        if (!isValidMap) {
            return res.status(400).json({ message: 'رابط خرائط Google غير صالح' });
        }
    }
    const result = await db.query(
        `INSERT INTO clients 
        (client_name, mobile_number, region, system_size_hp, price_per_hp, last_update_note, employee_id, wells_count, project_map_url, admin_seen) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [clientName, mobileNumber, region, systemSizeHp, pricePerHp, lastUpdateNote, employeeIdInt, wellsInt, url, false]
    );

    res.json({ id: result.rows[0].id, message: 'تمت الإضافة بنجاح' });
}));

app.put('/api/clients/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.body.adminSeen !== undefined && Object.keys(req.body).length === 1) {
        await db.query('UPDATE clients SET admin_seen = $1 WHERE id = $2', [req.body.adminSeen, id]);
        return res.json({ message: 'Updated seen status' });
    }

    const { clientName, mobileNumber, region, systemSizeHp, pricePerHp, lastUpdateNote, wellsCount, projectMapUrl } = req.body;

    if (mobileNumber) {
        const existingResult = await db.query('SELECT id FROM clients WHERE mobile_number = $1 AND id != $2', [mobileNumber, id]);
        if (existingResult.rows.length > 0) {
            return res.status(400).json({ message: 'رقم الجوال مسجل لعميل آخر' });
        }
    }

    const wellsInt = wellsCount !== undefined && wellsCount !== null ? parseInt(wellsCount, 10) : null;
    if (wellsInt !== null && (Number.isNaN(wellsInt) || wellsInt < 1 || wellsInt > 100)) {
        return res.status(400).json({ message: 'عدد الآبار يجب أن يكون بين 1 و 100' });
    }
    const url = projectMapUrl || null;
    if (url !== null) {
        const isValidMap = /^https?:\/\/(www\.)?google\.(com|[a-z]{2})\/maps\//i.test(url) || /^https?:\/\/maps\.app\.goo\.gl\//i.test(url);
        if (!isValidMap) {
            return res.status(400).json({ message: 'رابط خرائط Google غير صالح' });
        }
    }
    await db.query(
    if (lastUpdateNote) {
        const currentClient = await db.query('SELECT last_update_note FROM clients WHERE id = $1', [id]);
        if (currentClient.rows.length > 0 && currentClient.rows[0].last_update_note !== lastUpdateNote) {
            await db.query('INSERT INTO client_logs (client_id, note) VALUES ($1, $2)', [id, lastUpdateNote]);
        }
    }
    await db.query(
        `UPDATE clients SET 
        client_name = $1, mobile_number = $2, region = $3, system_size_hp = $4, price_per_hp = $5, last_update_note = $6, wells_count = $7, project_map_url = $8, admin_seen = $9, updated_at = CURRENT_TIMESTAMP
        WHERE id = $10`,
        [clientName, mobileNumber, region, systemSizeHp, pricePerHp, lastUpdateNote, wellsInt, url, false, id]
    );

    res.json({ message: 'Updated successfully' });
}));

app.delete('/api/clients/:id', asyncHandler(async (req, res) => {
    await db.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
}));

// --- Stats Route ---
app.get('/api/stats', asyncHandler(async (req, res) => {
    const result = await db.query('SELECT system_size_hp, price_per_hp FROM clients');
    const clients = result.rows;

    const totalClients = clients.length;
    const totalSystemSize = clients.reduce((acc, c) => acc + Number(c.system_size_hp || 0), 0);
    const totalProjectValue = clients.reduce((acc, c) => acc + (Number(c.system_size_hp || 0) * Number(c.price_per_hp || 0)), 0);

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
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Running By Faisal</title>
  <style>
    body { margin:0; background:#0f172a; color:#fff; font-family:system-ui,-apple-system,'Segoe UI',Roboto,Ubuntu; height:100vh; display:flex; align-items:center; justify-content:center }
    .container { display:flex; align-items:center; justify-content:center }
    .loader { position:relative; width:200px; height:200px; perspective:800px }
    .crystal { position:absolute; top:50%; left:50%; width:60px; height:60px; opacity:0; transform-origin:bottom center; transform:translate(-50%,-50%) rotateX(45deg) rotateZ(0deg); animation: spin 4s linear infinite, emerge 2s ease-in-out infinite alternate, fadeIn .3s ease-out forwards; border-radius:10px; visibility:hidden }
    @keyframes spin { from { transform:translate(-50%,-50%) rotateX(45deg) rotateZ(0deg) } to { transform:translate(-50%,-50%) rotateX(45deg) rotateZ(360deg) } }
    @keyframes emerge { 0%,100% { transform:translate(-50%,-50%) scale(.5); opacity:0 } 50% { transform:translate(-50%,-50%) scale(1); opacity:1 } }
    @keyframes fadeIn { to { visibility:visible; opacity:.8 } }
    .crystal:nth-child(1) { background:linear-gradient(45deg,#003366,#336699); animation-delay:0s }
    .crystal:nth-child(2) { background:linear-gradient(45deg,#003399,#3366cc); animation-delay:.3s }
    .crystal:nth-child(3) { background:linear-gradient(45deg,#0066cc,#3399ff); animation-delay:.6s }
    .crystal:nth-child(4) { background:linear-gradient(45deg,#0099ff,#66ccff); animation-delay:.9s }
    .crystal:nth-child(5) { background:linear-gradient(45deg,#33ccff,#99ccff); animation-delay:1.2s }
    .crystal:nth-child(6) { background:linear-gradient(45deg,#66ffff,#ccffff); animation-delay:1.5s }
  </style>
</head>
<body>
  <div class="container">
    <div class="loader">
      <div class="crystal"></div>
      <div class="crystal"></div>
      <div class="crystal"></div>
      <div class="crystal"></div>
      <div class="crystal"></div>
      <div class="crystal"></div>
    </div>
  </div>
</body>
</html>`);
});
// Client Logs
app.get('/api/clients/:id/logs', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await db.query('SELECT id, note, created_at FROM client_logs WHERE client_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows);
}));
