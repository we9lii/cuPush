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
            role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee', 'editor')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        try { await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`); } catch (e) {}
        try { await db.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','employee','editor'))`); } catch (e) {}
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

        await db.query(`CREATE TABLE IF NOT EXISTS assignments (
            id SERIAL PRIMARY KEY,
            client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
            client_name VARCHAR(100) NOT NULL,
            employee_id INTEGER REFERENCES users(id),
            employee_name VARCHAR(100) NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            snapshot_mobile_number VARCHAR(15),
            snapshot_region VARCHAR(100),
            snapshot_system_size_hp DECIMAL(10,2),
            snapshot_wells_count INTEGER,
            snapshot_project_map_url TEXT,
            snapshot_price_per_hp DECIMAL(10,2),
            snapshot_last_update_note TEXT,
            snapshot_client_created_at TIMESTAMP
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS assignment_updates (
            id SERIAL PRIMARY KEY,
            assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
            note TEXT NOT NULL,
            status TEXT,
            result TEXT,
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
    if (!['admin', 'employee', 'editor'].includes(roleLower)) {
        return res.status(400).json({ message: 'دور غير صالح. استخدم admin أو employee أو editor' });
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

// --- Assignments Routes ---

app.get('/api/assignments', asyncHandler(async (req, res) => {
    const result = await db.query(`
        SELECT a.* FROM assignments a ORDER BY a.assigned_at DESC
    `);
    const rows = result.rows;
    // Fetch updates for all assignments
    const ids = rows.map(r => r.id);
    let updatesByAssignment = new Map();
    if (ids.length > 0) {
        const upd = await db.query(
            `SELECT id, assignment_id, note, status, result, created_at 
             FROM assignment_updates 
             WHERE assignment_id = ANY($1::int[]) 
             ORDER BY created_at DESC`, [ids]
        );
        updatesByAssignment = upd.rows.reduce((m, u) => {
            const arr = m.get(u.assignment_id) || [];
            arr.push({ id: u.id, note: u.note, status: u.status || null, result: u.result || null, createdAt: u.created_at });
            m.set(u.assignment_id, arr);
            return m;
        }, new Map());
    }
    const formatted = rows.map(r => ({
        id: String(r.id),
        clientId: String(r.client_id),
        clientName: r.client_name,
        employeeId: String(r.employee_id),
        employeeName: r.employee_name,
        assignedAt: r.assigned_at,
        snapshot: {
            mobileNumber: r.snapshot_mobile_number,
            region: r.snapshot_region,
            systemSizeHp: r.snapshot_system_size_hp !== null ? Number(r.snapshot_system_size_hp) : undefined,
            wellsCount: r.snapshot_wells_count !== null ? Number(r.snapshot_wells_count) : undefined,
            projectMapUrl: r.snapshot_project_map_url || undefined,
            pricePerHp: r.snapshot_price_per_hp !== null ? Number(r.snapshot_price_per_hp) : undefined,
            lastUpdateNote: r.snapshot_last_update_note || undefined,
            createdAt: r.snapshot_client_created_at || undefined
        },
        updates: updatesByAssignment.get(r.id) || []
    }));
    res.json(formatted);
}));

app.post('/api/assignments', asyncHandler(async (req, res) => {
    const { clientId, employeeId, clientName, employeeName, snapshot } = req.body || {};
    if (!clientId || !employeeId || !clientName || !employeeName || !snapshot || !snapshot.mobileNumber) {
        return res.status(400).json({ message: 'invalid_payload' });
    }
    const result = await db.query(
        `INSERT INTO assignments 
        (client_id, client_name, employee_id, employee_name, 
         snapshot_mobile_number, snapshot_region, snapshot_system_size_hp, snapshot_wells_count, 
         snapshot_project_map_url, snapshot_price_per_hp, snapshot_last_update_note, snapshot_client_created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id, assigned_at`,
        [
            parseInt(clientId, 10),
            String(clientName),
            parseInt(employeeId, 10),
            String(employeeName),
            String(snapshot.mobileNumber),
            snapshot.region || null,
            snapshot.systemSizeHp ?? null,
            snapshot.wellsCount ?? null,
            snapshot.projectMapUrl || null,
            snapshot.pricePerHp ?? null,
            snapshot.lastUpdateNote || null,
            snapshot.createdAt ? new Date(snapshot.createdAt) : null
        ]
    );
    const id = result.rows[0].id;
    const assignedAt = result.rows[0].assigned_at;
    res.status(201).json({
        id: String(id),
        clientId: String(clientId),
        clientName,
        employeeId: String(employeeId),
        employeeName,
        assignedAt,
        snapshot,
        updates: []
    });
}));

app.post('/api/assignments/:id/updates', asyncHandler(async (req, res) => {
    const assignmentId = parseInt(req.params.id, 10);
    const { note, status, result } = req.body || {};
    if (!note || String(note).trim() === '') return res.status(400).json({ message: 'note_required' });
    const exists = await db.query('SELECT id FROM assignments WHERE id = $1', [assignmentId]);
    if (exists.rows.length === 0) return res.status(404).json({ message: 'assignment_not_found' });
    const ins = await db.query(
        `INSERT INTO assignment_updates (assignment_id, note, status, result) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
        [assignmentId, note, status || null, result || null]
    );
    res.status(201).json({ id: ins.rows[0].id, note, status, result, createdAt: ins.rows[0].created_at });
}));

app.delete('/api/assignments/:id', asyncHandler(async (req, res) => {
    const assignmentId = parseInt(req.params.id, 10);
    const del = await db.query('DELETE FROM assignments WHERE id = $1', [assignmentId]);
    if (del.rowCount === 0) return res.status(404).json({ message: 'assignment_not_found' });
    res.status(204).end();
}));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

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

// Client Logs
app.get('/api/clients/:id/logs', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await db.query('SELECT id, note, created_at FROM client_logs WHERE client_id = $1 ORDER BY created_at DESC', [id]);
    res.json(result.rows);
}));
