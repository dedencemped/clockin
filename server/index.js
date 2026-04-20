import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'absensi_online';
const PORT = Number(process.env.PORT || 3001);

let pool;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = String(stored).split(':');
  const calc = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

async function tryFetch(url, opts) {
  try {
    // Node 18+ has global fetch
    const f = globalThis.fetch ? globalThis.fetch : null;
    if (!f) return null;
    const r = await f(url, opts);
    return r;
  } catch {
    return null;
  }
}

async function notifyResetToken({ email, phone, token, emailWebhook, emailAuth, waWebhook, waAuth }) {
  const emailWebhookUrl = emailWebhook || process.env.EMAIL_WEBHOOK_URL || null;
  const emailAuthHeader = emailAuth || process.env.EMAIL_WEBHOOK_AUTH || null; // e.g., Bearer <token> or Basic ...
  const waWebhookUrl = waWebhook || process.env.WHATSAPP_WEBHOOK_URL || null;
  const waAuthHeader = waAuth || process.env.WHATSAPP_WEBHOOK_AUTH || null;
  const appName = process.env.APP_NAME || 'Absensi Online';
  const subject = `${appName} - Token Reset Password`;
  const text = `Token reset password Anda: ${token}\nBerlaku 30 menit.\nJangan bagikan token ini kepada siapa pun.`;
  // Send Email via webhook
  if (emailWebhookUrl && email) {
    await tryFetch(emailWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(emailAuthHeader ? { 'Authorization': emailAuthHeader } : {}),
      },
      body: JSON.stringify({ to: email, subject, text })
    });
  }
  // Send WhatsApp via webhook
  if (waWebhookUrl && phone) {
    await tryFetch(waWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(waAuthHeader ? { 'Authorization': waAuthHeader } : {}),
      },
      body: JSON.stringify({ to: phone, message: text })
    });
  }
}

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id VARCHAR(50),
      nik VARCHAR(32) NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE,
      password_hash VARCHAR(255) NULL,
      role ENUM('superadmin','admin','hrd','karyawan') DEFAULT 'karyawan',
      status ENUM('aktif','nonaktif') DEFAULT 'aktif',
      must_change_password TINYINT(1) NOT NULL DEFAULT 0,
      position VARCHAR(100) NULL,
      department VARCHAR(100) NULL,
      phone VARCHAR(50) NULL,
      branch_id INT NULL,
      company_id INT NULL,
      join_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // Ensure enum includes 'superadmin' on existing installations
  await pool.query(`
    ALTER TABLE employees 
    MODIFY role ENUM('superadmin','admin','hrd','karyawan') DEFAULT 'karyawan'
  `).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN nik VARCHAR(32) NULL`).catch(()=>{});
  await pool.query(`CREATE UNIQUE INDEX uniq_employees_nik ON employees(nik)`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN phone VARCHAR(50) NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN branch_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD COLUMN shift_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD CONSTRAINT fk_employees_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL`).catch(e => console.log('Constraint fk_employees_shift already exists or failed:', e.message));
  await pool.query(`ALTER TABLE employees ADD COLUMN company_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE employees ADD CONSTRAINT fk_employees_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL`).catch(e => console.log('Constraint fk_employees_company already exists or failed:', e.message));
  await pool.query(`ALTER TABLE employees ADD COLUMN join_date DATE NULL`).catch(()=>{});
  // Set default password for employees without password (karyawan/hrd)
  await pool.query(
    `UPDATE employees SET password_hash=?, must_change_password=1 WHERE (password_hash IS NULL OR password_hash='') AND role IN ('karyawan','hrd')`
  , [hashPassword('123456')]).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      address VARCHAR(255),
      latitude DECIMAL(10,6) NOT NULL DEFAULT 0,
      longitude DECIMAL(10,6) NOT NULL DEFAULT 0,
      radius INT NOT NULL DEFAULT 100,
      company_id INT NULL,
      status ENUM('aktif','nonaktif') DEFAULT 'aktif',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`ALTER TABLE branches ADD COLUMN company_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE branches ADD CONSTRAINT fk_branches_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`key\` VARCHAR(100) NOT NULL,
      company_id INT NULL,
      \`value\` TEXT NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`ALTER TABLE system_settings ADD COLUMN company_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE system_settings ADD CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`).catch(()=>{});
  // Migrate unique constraint to (company_id, key)
  await pool.query(`ALTER TABLE system_settings DROP INDEX \`key\``).catch(()=>{});
  await pool.query(`CREATE UNIQUE INDEX uniq_settings_company_key ON system_settings(company_id, \`key\`)`).catch(()=>{});
  // Ensure tables exist in correct order
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      owner_email VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NULL,
      address VARCHAR(255) NULL,
      industry VARCHAR(100) NULL,
      employee_count INT DEFAULT 0,
      status ENUM('pending','aktif','nonaktif') DEFAULT 'pending',
      active_until DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`ALTER TABLE companies ADD COLUMN active_until DATE NULL`).catch(()=>{});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      company_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_shifts_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `).catch(e => console.error('CRITICAL: Failed to create shifts table:', e));

  const [[cCount]] = await pool.query(`SELECT COUNT(*) AS c FROM companies`);
  if (cCount.c === 0) {
    await pool.query(
      `INSERT INTO companies (name, owner_email, phone, address, industry, employee_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      ['Contoh Corp', 'admin@example.com', '0812000000', 'Jl. Contoh No.1', 'Teknologi', 0]
    ).catch(()=>{});
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(150) NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // Add company_id to password_resets for reliable scoping
  await pool.query(`ALTER TABLE password_resets ADD COLUMN company_id INT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE password_resets ADD CONSTRAINT fk_pwreset_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL`).catch(()=>{});
  // Backfill company_id for existing tokens using employees table
  await pool.query(`
    UPDATE password_resets pr
    LEFT JOIN employees e ON e.email = pr.email
    SET pr.company_id = e.company_id
    WHERE pr.company_id IS NULL
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      date DATE NOT NULL,
      check_in DATETIME NULL,
      check_out DATETIME NULL,
      status ENUM('hadir','izin','alpha','cuti','sakit','terlambat','lembur') DEFAULT 'hadir',
      late_minutes INT DEFAULT 0,
      overtime_minutes INT DEFAULT 0,
      branch_id INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_employee_date (employee_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    ALTER TABLE attendance 
    MODIFY status ENUM('hadir','izin','alpha','cuti','sakit','terlambat','lembur') DEFAULT 'hadir'
  `).catch(()=>{});
  await pool.query(`ALTER TABLE attendance ADD COLUMN notes TEXT NULL`).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      type ENUM('izin','cuti','sakit','dinas_luar','terlambat_masuk','lain_lain') NOT NULL DEFAULT 'izin',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      notes TEXT NULL,
      status ENUM('pending','disetujui','ditolak') DEFAULT 'pending',
      approved_by VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    ALTER TABLE leave_requests 
    MODIFY type ENUM('izin','cuti','sakit','dinas_luar','terlambat_masuk','lain_lain') NOT NULL DEFAULT 'izin'
  `).catch(()=>{});
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN notes TEXT NULL`).catch(()=>{});

  const [[adminExists]] = await pool.query(`SELECT COUNT(*) AS c FROM employees WHERE role='admin'`);
  if (adminExists.c === 0) {
    await pool.query(
      `INSERT IGNORE INTO employees (employee_id, full_name, email, password_hash, role, status, position, department)
       VALUES (?, ?, ?, ?, 'admin', 'aktif', 'Administrator', 'IT')`,
      ['ADM-001', 'Admin', 'admin@example.com', hashPassword('admin123')]
    );
  }
  // Ensure default password for legacy admin without password
  await pool.query(
    `UPDATE employees SET password_hash=? WHERE role='admin' AND (password_hash IS NULL OR password_hash='') LIMIT 1`,
    [hashPassword('admin123')]
  ).catch(()=>{});
  // Ensure default admin account by email (if role mismatch)
  await pool.query(
    `UPDATE employees SET password_hash=?, role='admin', status='aktif' WHERE email='admin@example.com' AND (password_hash IS NULL OR password_hash='')`
  , [hashPassword('admin123')]).catch(()=>{});
  // Ensure admin@example.com exists
  const [[adminByEmail]] = await pool.query(`SELECT id FROM employees WHERE email='admin@example.com' LIMIT 1`);
  if (!adminByEmail) {
    await pool.query(
      `INSERT INTO employees (employee_id, full_name, email, password_hash, role, status, position, department)
       VALUES (?, ?, ?, ?, 'admin', 'aktif', 'Administrator', 'IT')`,
      ['ADM-001', 'Admin', 'admin@example.com', hashPassword('admin123')]
    ).catch(()=>{});
  }
  const [[saExists]] = await pool.query(`SELECT COUNT(*) AS c FROM employees WHERE role='superadmin'`);
  if (saExists.c === 0) {
    await pool.query(
      `INSERT IGNORE INTO employees (employee_id, full_name, email, password_hash, role, status, position, department)
       VALUES (?, ?, ?, ?, 'superadmin', 'aktif', 'Super Admin', 'IT')`,
      ['SA-001', 'Super Admin', 'superadmin@example.com', hashPassword('superadmin123')]
    );
  }
  // Ensure default password for legacy superadmin without password
  await pool.query(
    `UPDATE employees SET password_hash=? WHERE role='superadmin' AND (password_hash IS NULL OR password_hash='') LIMIT 1`,
    [hashPassword('superadmin123')]
  ).catch(()=>{});
  // Ensure default superadmin account by email (if role mismatch)
  await pool.query(
    `UPDATE employees SET password_hash=?, role='superadmin', status='aktif' WHERE email='superadmin@example.com' AND (password_hash IS NULL OR password_hash='')`
  , [hashPassword('superadmin123')]).catch(()=>{});
  // Ensure superadmin@example.com exists
  const [[saByEmail]] = await pool.query(`SELECT id FROM employees WHERE email='superadmin@example.com' LIMIT 1`);
  if (!saByEmail) {
    await pool.query(
      `INSERT INTO employees (employee_id, full_name, email, password_hash, role, status, position, department)
       VALUES (?, ?, ?, ?, 'superadmin', 'aktif', 'Super Admin', 'IT')`,
      ['SA-001', 'Super Admin', 'superadmin@example.com', hashPassword('superadmin123')]
    ).catch(()=>{});
  }
}

function ok(res, data) { res.json(data); }
function err(res, e) { 
  console.error('API Error:', e);
  res.status(500).json({ error: e.message || 'Internal Server Error' }); 
}

// Debug: list routes (dev only)
app.get('/api/health', (_req, res) => {
  try {
    const routes = (app._router?.stack || [])
      .filter((r) => r.route && r.route.path)
      .map((r) => ({ path: r.route.path, methods: Object.keys(r.route.methods) }));
    ok(res, { ok: true, routes });
  } catch (e) { err(res, e); }
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    const [[user]] = await pool.query(`SELECT * FROM employees WHERE email = ? LIMIT 1`, [email]);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (user.status && user.status !== 'aktif') {
      return res.status(403).json({ error: 'Akun nonaktif. Hubungi administrator.' });
    }
    // Block login for non-superadmin when linked company is not active
    if (user.role !== 'superadmin') {
      let companyRow = null;
      if (user.company_id) {
        const [[c1]] = await pool.query(`SELECT status, active_until FROM companies WHERE id = ? LIMIT 1`, [user.company_id]).catch(()=>[[]]);
        companyRow = c1 || null;
      } else {
        const [[c2]] = await pool.query(`SELECT status, active_until FROM companies WHERE owner_email = ? LIMIT 1`, [email]).catch(()=>[[]]);
        companyRow = c2 || null;
      }
      if (companyRow && companyRow.status && companyRow.status !== 'aktif') {
        return res.status(403).json({ error: 'Perusahaan belum aktif. Menunggu approval.' });
      }
      if (companyRow && companyRow.active_until) {
        const expiresAt = new Date(companyRow.active_until);
        expiresAt.setHours(23, 59, 59, 999);
        if (expiresAt < new Date()) {
          return res.status(403).json({ error: 'Masa aktif Perusahaan anda Sudah Habis . segera perpanjang masa aktif' });
        }
      }
    }
    if (!password || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    ok(res, { user });
  } catch (e) { err(res, e); }
});

// Register company + admin user
app.post('/api/auth/register-company', async (req, res) => {
  try {
    const { name, email, password, phone, address, industry, employee_count } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const [[existsEmp]] = await pool.query(`SELECT id FROM employees WHERE email = ? LIMIT 1`, [email]);
    if (existsEmp) return res.status(409).json({ error: 'Email sudah terdaftar' });
    const [cr] = await pool.query(
      `INSERT INTO companies (name, owner_email, phone, address, industry, employee_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [name, email, phone || null, address || null, industry || null, Number(employee_count) || 0]
    );
    await pool.query(
      `INSERT INTO employees (employee_id, full_name, email, password_hash, role, status, position, department)
       VALUES (?, ?, ?, ?, 'admin', 'aktif', 'Administrator', 'Manajemen')`,
      ['OWNER-1', name + ' Admin', email, hashPassword(password)]
    );
    await pool.query(`UPDATE employees SET company_id=? WHERE email=?`, [cr.insertId, email]);
    await pool.query(
      `INSERT INTO branches (name, address, latitude, longitude, radius, status, company_id)
       VALUES (?, ?, ?, ?, ?, 'aktif', ?)`,
      ['Kantor Pusat', address || null, 0, 0, 100, cr.insertId]
    ).catch(()=>{});
    // Reset system settings to defaults for a fresh company onboarding
    const defaults = [
      { key: 'work_hours', value: JSON.stringify({ start: '08:00', end: '17:00', name: 'Jam Kerja' }), description: 'Jam kerja' },
      { key: 'late_threshold', value: JSON.stringify(15), description: 'Batas terlambat (menit)' },
      { key: 'work_days', value: JSON.stringify([1,2,3,4,5]), description: 'Hari kerja (0=Minggu ... 6=Sabtu)' },
      { key: 'holidays', value: JSON.stringify([]), description: 'Hari libur' },
    ];
    for (const d of defaults) {
      const [[exists]] = await pool.query(`SELECT id FROM system_settings WHERE \`key\` = ? AND company_id = ? LIMIT 1`, [d.key, cr.insertId]).catch(()=>[[]]);
      if (exists && exists.id) {
        await pool.query(`UPDATE system_settings SET \`value\`=?, description=? WHERE id=?`, [d.value, d.description, exists.id]).catch(()=>{});
      } else {
        await pool.query(`INSERT INTO system_settings (\`key\`, \`value\`, description, company_id) VALUES (?, ?, ?, ?)`, [d.key, d.value, d.description, cr.insertId]).catch(()=>{});
      }
    }
    ok(res, { company_id: cr.insertId, status: 'pending' });
  } catch (e) { err(res, e); }
});
// Employees
// Companies
app.get('/api/companies', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, name, owner_email, phone, address, industry, employee_count, status, active_until, created_at FROM companies ORDER BY id DESC`);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.put('/api/companies/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, name, phone, address, industry, employee_count, active_until } = req.body || {};
    const fields = [];
    const params = [];
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { fields.push('address = ?'); params.push(address); }
    if (industry !== undefined) { fields.push('industry = ?'); params.push(industry); }
    if (employee_count !== undefined) { fields.push('employee_count = ?'); params.push(employee_count); }
    if (active_until !== undefined) {
      const norm = (active_until === null || active_until === '') ? null : String(active_until).slice(0, 10);
      fields.push('active_until = ?');
      params.push(norm);
    }
    if (fields.length) {
      await pool.query(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }
    const [[row]] = await pool.query(`SELECT id, name, owner_email, phone, address, industry, employee_count, status, active_until, created_at FROM companies WHERE id = ?`, [id]);
    ok(res, row || null);
  } catch (e) { err(res, e); }
});

// Password reset
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const [[user]] = await pool.query(`SELECT id, full_name, phone, company_id FROM employees WHERE email = ? LIMIT 1`, [email]);
    if (!user) return res.status(404).json({ error: 'Email tidak ditemukan' });
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30m
    await pool.query(`INSERT INTO password_resets (email, token, expires_at, company_id) VALUES (?, ?, ?, ?)`, [email, token, expires, user.company_id || null]);
    // Resolve webhook from company settings (company-scoped), fallback to global env
    let emailWebhook = null, emailAuth = null, waWebhook = null, waAuth = null;
    if (user.company_id) {
      const [rows] = await pool.query(
        `SELECT \`key\`, \`value\` FROM system_settings WHERE company_id = ? AND \`key\` IN ('email_webhook_url','email_webhook_auth','whatsapp_webhook_url','whatsapp_webhook_auth')`,
        [user.company_id]
      ).catch(()=>[[]]);
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r.key === 'email_webhook_url') emailWebhook = r.value;
          if (r.key === 'email_webhook_auth') emailAuth = r.value;
          if (r.key === 'whatsapp_webhook_url') waWebhook = r.value;
          if (r.key === 'whatsapp_webhook_auth') waAuth = r.value;
        }
      }
    }
    // Send token to ADMIN/HRD of the same company for manual forwarding to employee
    if (user.company_id) {
      const [admins] = await pool.query(
        `SELECT email, phone FROM employees WHERE company_id = ? AND role IN ('admin','hrd') AND status='aktif'`,
        [user.company_id]
      ).catch(()=>[[]]);
      if (Array.isArray(admins) && admins.length > 0) {
        const appName = process.env.APP_NAME || 'Absensi Online';
        const subjectSuffix = ` (untuk ${user.full_name || email})`;
        for (const a of admins) {
          // Reuse notify helper; keep body generic
          await notifyResetToken({
            email: a.email || null,
            phone: a.phone || null,
            token,
            emailWebhook,
            emailAuth,
            waWebhook,
            waAuth
          }).catch(()=>{});
        }
      } else {
        // Fallback: if no admin/hrd found, send to employee directly
        await notifyResetToken({
          email,
          phone: user.phone || null,
          token,
          emailWebhook,
          emailAuth,
          waWebhook,
          waAuth
        }).catch(()=>{});
      }
    } else {
      // No company_id: fallback to sending to employee
      await notifyResetToken({
        email,
        phone: user.phone || null,
        token,
        emailWebhook,
        emailAuth,
        waWebhook,
        waAuth
      }).catch(()=>{});
    }
    // For security, optionally hide token in response unless explicitly allowed
    const expose = String(process.env.EXPOSE_RESET_TOKEN || '').toLowerCase() === 'true';
    ok(res, expose ? { token, expires_at: expires.toISOString() } : { ok: true, expires_at: expires.toISOString() });
  } catch (e) { err(res, e); }
});
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    const [[row]] = await pool.query(`SELECT email, expires_at FROM password_resets WHERE token = ? LIMIT 1`, [token]);
    if (!row) return res.status(404).json({ error: 'Token tidak valid' });
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Token kadaluarsa' });
    await pool.query(`UPDATE employees SET password_hash=? WHERE email=?`, [hashPassword(password), row.email]);
    await pool.query(`DELETE FROM password_resets WHERE token = ?`, [token]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body || {};
    if (!email || !current_password || !new_password) return res.status(400).json({ error: 'email, current_password, new_password required' });
    const [[user]] = await pool.query(`SELECT id, role, password_hash FROM employees WHERE email = ? LIMIT 1`, [email]);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (user.role !== 'superadmin') return res.status(403).json({ error: 'Hanya superadmin yang dapat mengubah password di endpoint ini' });
    if (!user.password_hash || !verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Password saat ini salah' });
    }
    await pool.query(`UPDATE employees SET password_hash=? WHERE id=?`, [hashPassword(new_password), user.id]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});
// Password reset tokens list (admin/hrd/superadmin)
app.get('/api/password-resets', async (req, res) => {
  try {
    // Auto-cleanup: remove expired tokens before listing
    await pool.query(`DELETE FROM password_resets WHERE expires_at < NOW()`).catch(()=>{});
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const activeOnly = String(req.query.active_only || 'true').toLowerCase() !== 'false';
    let sql = `
      SELECT pr.email, pr.token, pr.expires_at, pr.created_at,
             e.full_name AS employee_name, e.phone AS employee_phone, pr.company_id
      FROM password_resets pr
      LEFT JOIN employees e ON e.email = pr.email
    `;
    const where = [];
    const params = [];
    if (companyId) {
      where.push('(pr.company_id = ? OR (pr.company_id IS NULL AND e.company_id = ?))');
      params.push(companyId, companyId);
    }
    if (activeOnly) { where.push('pr.expires_at > NOW()'); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY pr.created_at DESC';
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
// Employees
app.get('/api/employees', async (req, res) => {
  try {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    let sql = `
      SELECT e.*, s.name AS shift_name, s.start_time AS shift_start, s.end_time AS shift_end
      FROM employees e
      LEFT JOIN shifts s ON s.id = e.shift_id
    `;
    const params = [];
    if (companyId) { sql += ` WHERE e.company_id = ?`; params.push(companyId); }
    sql += ` ORDER BY e.id DESC`;
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/employees', async (req, res) => {
  try {
    const { employee_id, nik, full_name, email, role, status, position, department, phone, branch_id, join_date, company_id, shift_id } = req.body || {};
    if (!full_name) return res.status(400).json({ error: 'full_name is required' });
    const [r] = await pool.query(
      `INSERT INTO employees (employee_id, nik, full_name, email, password_hash, must_change_password, role, status, position, department, phone, branch_id, company_id, join_date, shift_id)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [employee_id || null, nik || null, full_name, email || null, hashPassword('123456'), role || 'karyawan', status || 'aktif', position || null, department || null, phone || null, branch_id || null, company_id || null, join_date || null, shift_id || null]
    );
    const [[row]] = await pool.query(`SELECT * FROM employees WHERE id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) { err(res, e); }
});
app.put('/api/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { employee_id, nik, full_name, email, role, status, position, department, phone, branch_id, company_id, join_date, shift_id } = req.body || {};
    await pool.query(
      `UPDATE employees SET
        employee_id = COALESCE(?, employee_id),
        nik = COALESCE(?, nik),
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        position = COALESCE(?, position),
        department = COALESCE(?, department),
        phone = COALESCE(?, phone),
        branch_id = COALESCE(?, branch_id),
        company_id = COALESCE(?, company_id),
        join_date = COALESCE(?, join_date),
        shift_id = COALESCE(?, shift_id)
      WHERE id = ?`,
      [employee_id ?? null, nik ?? null, full_name ?? null, email ?? null, role ?? null, status ?? null, position ?? null, department ?? null, phone ?? null, branch_id ?? null, company_id ?? null, join_date ?? null, shift_id ?? null, id]
    );
    const [[row]] = await pool.query(`SELECT * FROM employees WHERE id = ?`, [id]);
    ok(res, row || null);
  } catch (e) { err(res, e); }
});

// Shifts
app.get('/api/shifts', async (req, res) => {
  try {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    let sql = `SELECT * FROM shifts`;
    const params = [];
    if (companyId) { sql += ` WHERE company_id = ?`; params.push(companyId); }
    sql += ` ORDER BY name ASC`;
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/shifts', async (req, res) => {
  try {
    console.log('POST /api/shifts body:', req.body);
    const { name, start_time, end_time, company_id } = req.body || {};
    if (!name || !start_time || !end_time || !company_id) {
      console.warn('POST /api/shifts missing fields:', { name, start_time, end_time, company_id });
      return res.status(400).json({ error: 'Nama, Jam Masuk, Jam Pulang, dan ID Perusahaan wajib diisi' });
    }
    // Ensure HH:mm:ss format for MySQL TIME
    const formatTime = (t) => t.split(':').length === 2 ? `${t}:00` : t;
    const [r] = await pool.query(
      `INSERT INTO shifts (name, start_time, end_time, company_id) VALUES (?, ?, ?, ?)`,
      [name, formatTime(start_time), formatTime(end_time), Number(company_id)]
    );
    const [[row]] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [r.insertId]);
    ok(res, row);
  } catch (e) { err(res, e); }
});
app.put('/api/shifts/:id', async (req, res) => {
  try {
    console.log(`PUT /api/shifts/${req.params.id} body:`, req.body);
    const id = Number(req.params.id);
    const { name, start_time, end_time } = req.body || {};
    
    const formatTime = (t) => t && t.split(':').length === 2 ? `${t}:00` : t;
    
    await pool.query(
      `UPDATE shifts SET
        name = COALESCE(?, name),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time)
      WHERE id = ?`,
      [name ?? null, formatTime(start_time) ?? null, formatTime(end_time) ?? null, id]
    );
    const [[row]] = await pool.query(`SELECT * FROM shifts WHERE id = ?`, [id]);
    ok(res, row);
  } catch (e) { err(res, e); }
});
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM shifts WHERE id = ?`, [Number(req.params.id)]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});
app.delete('/api/employees/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM employees WHERE id = ?`, [Number(req.params.id)]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});
// Import CSV
app.post('/api/employees/import', async (req, res) => {
  try {
    const records = req.body?.records;
    const defaultCompanyId = req.query.company_id ? Number(req.query.company_id) : (req.body?.company_id ? Number(req.body.company_id) : null);
    if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'records required' });
    let insertedCount = 0;
    let skipped = 0;
    for (const r of records) {
      const full_name = (r.full_name || '').trim();
      if (!full_name) { skipped++; continue; }
      const employee_id = r.employee_id || null;
      const nik = r.nik || null;
      const email = r.email || null;
      const role = r.role || 'karyawan';
      const status = r.status || 'aktif';
      const position = r.position || null;
      const department = r.department || null;
      const phone = r.phone || null;
      const branch_id = r.branch_id ? Number(r.branch_id) : null;
      const company_id = r.company_id ? Number(r.company_id) : (defaultCompanyId || null);
      const join_date = r.join_date || null;
      try {
        const [rs] = await pool.query(
          `INSERT INTO employees (employee_id, nik, full_name, email, password_hash, must_change_password, role, status, position, department, phone, branch_id, company_id, join_date)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [employee_id, nik, full_name, email, hashPassword('123456'), role, status, position, department, phone, branch_id, company_id, join_date]
        );
        if (rs.insertId) insertedCount++;
      } catch (_) {
        skipped++;
        continue;
      }
    }
    ok(res, { inserted: insertedCount, skipped });
  } catch (e) { err(res, e); }
});

app.post('/api/auth/change-password-self', async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body || {};
    if (!email || !current_password || !new_password) return res.status(400).json({ error: 'email, current_password, new_password required' });
    const [[user]] = await pool.query(`SELECT id, password_hash FROM employees WHERE email = ? LIMIT 1`, [email]);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (!user.password_hash || !verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Password saat ini salah' });
    }
    await pool.query(`UPDATE employees SET password_hash=?, must_change_password=0 WHERE id=?`, [hashPassword(new_password), user.id]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});

// Branches
app.get('/api/branches', async (req, res) => {
  try {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    let sql = `SELECT * FROM branches`;
    const params = [];
    if (companyId) { sql += ` WHERE company_id = ?`; params.push(companyId); }
    sql += ` ORDER BY id DESC`;
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/branches', async (req, res) => {
  try {
    const { name, address, latitude, longitude, radius, status, company_id } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [r] = await pool.query(
      `INSERT INTO branches (name, address, latitude, longitude, radius, status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, address || null, Number(latitude) || 0, Number(longitude) || 0, Number(radius) || 100, status || 'aktif', company_id || null]
    );
    const [[row]] = await pool.query(`SELECT * FROM branches WHERE id = ?`, [r.insertId]);
    ok(res, row);
  } catch (e) { err(res, e); }
});
app.put('/api/branches/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, latitude, longitude, radius, status, company_id } = req.body || {};
    await pool.query(
      `UPDATE branches SET
        name = COALESCE(?, name),
        address = ?,
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        radius = COALESCE(?, radius),
        status = COALESCE(?, status),
        company_id = COALESCE(?, company_id)
      WHERE id = ?`,
      [name ?? null, address ?? null, latitude ?? null, longitude ?? null, radius ?? null, status ?? null, company_id ?? null, id]
    );
    const [[row]] = await pool.query(`SELECT * FROM branches WHERE id = ?`, [id]);
    ok(res, row);
  } catch (e) { err(res, e); }
});
app.delete('/api/branches/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM branches WHERE id = ?`, [Number(req.params.id)]);
    ok(res, { ok: true });
  } catch (e) { err(res, e); }
});

// System settings
app.get('/api/system-settings', async (_req, res) => {
  try {
    const companyId = _req.query.company_id ? Number(_req.query.company_id) : null;
    const [rows] = companyId
      ? await pool.query(`SELECT id, \`key\`, \`value\`, description, created_at, updated_at, company_id FROM system_settings WHERE company_id = ? ORDER BY id DESC`, [companyId])
      : await pool.query(`SELECT id, \`key\`, \`value\`, description, created_at, updated_at, company_id FROM system_settings WHERE company_id IS NULL ORDER BY id DESC`);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/system-settings', async (req, res) => {
  try {
    const { key, value, description, company_id } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key required' });
    const [r] = await pool.query(
      `INSERT INTO system_settings (\`key\`, \`value\`, description, company_id) VALUES (?, ?, ?, ?)`,
      [key, value ?? '', description ?? null, company_id ?? null]
    );
    const [[row]] = await pool.query(`SELECT id, \`key\`, \`value\`, description, company_id, created_at, updated_at FROM system_settings WHERE id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'key already exists for this company' });
    err(res, e);
  }
});
app.put('/api/system-settings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { key, value, description } = req.body || {};
    await pool.query(
      `UPDATE system_settings SET
        \`key\` = COALESCE(?, \`key\`),
        \`value\` = COALESCE(?, \`value\`),
        description = ?
      WHERE id = ?`,
      [key ?? null, value ?? null, description ?? null, id]
    );
    const [[row]] = await pool.query(`SELECT id, \`key\`, \`value\`, description, company_id, created_at, updated_at FROM system_settings WHERE id = ?`, [id]);
    ok(res, row || null);
  } catch (e) { err(res, e); }
});

// Attendance
app.get('/api/attendance', async (req, res) => {
  try {
    const date = req.query.date || null;
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    let sql = `
      SELECT a.id, a.employee_id, e.full_name AS employee_name, e.company_id, a.date, a.check_in, a.check_out, a.status, a.late_minutes, a.overtime_minutes, a.branch_id, a.notes
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
    `;
    const where = [];
    const params = [];
    if (date) { where.push('a.date = ?'); params.push(date); }
    if (companyId) { where.push('e.company_id = ?'); params.push(companyId); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY a.date DESC, a.id DESC';
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/attendance', async (req, res) => {
  try {
    const { employee_id, date, check_in_time, branch_id } = req.body || {};
    if (!employee_id || !date || !check_in_time) return res.status(400).json({ error: 'employee_id, date, check_in_time required' });
    const check_in = new Date(`${date}T${check_in_time}:00`);

    // Compute lateness and status on server for consistency
    let startStr = '08:00';
    let lateMinutes = 0;
    try {
      const [[emp]] = await pool.query(`SELECT company_id, shift_id FROM employees WHERE id = ? LIMIT 1`, [Number(employee_id)]);
      const companyId = emp?.company_id || null;
      const shiftId = emp?.shift_id || null;
      
      let whRow = null;
      if (shiftId) {
        const [[s]] = await pool.query(`SELECT start_time FROM shifts WHERE id = ? LIMIT 1`, [shiftId]);
        if (s?.start_time) {
          startStr = s.start_time;
        }
      }
      
      if (!shiftId) {
        if (companyId) {
          const [[wh1]] = await pool.query(`SELECT value FROM system_settings WHERE \`key\`='work_hours' AND company_id = ? LIMIT 1`, [companyId]).catch(()=>[[]]);
          whRow = wh1 || null;
        }
        if (!whRow) {
          const [[wh2]] = await pool.query(`SELECT value FROM system_settings WHERE \`key\`='work_hours' AND company_id IS NULL LIMIT 1`).catch(()=>[[]]);
          whRow = wh2 || null;
        }
        if (whRow?.value) {
          try {
            const v = JSON.parse(whRow.value);
            if (typeof v?.start === 'string') startStr = v.start;
          } catch {}
        }
      }
      
      const [sh, sm] = String(startStr).split(':').map(n => Number(n) || 0);
      const startDate = new Date(`${date}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`);
      const diffMs = check_in.getTime() - startDate.getTime();
      lateMinutes = diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
    } catch { /* ignore compute errors, keep defaults */ }
    const status = lateMinutes > 0 ? 'terlambat' : 'hadir';
    const [r] = await pool.query(
      `INSERT INTO attendance (employee_id, date, check_in, status, late_minutes, branch_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(employee_id), date, check_in, status, lateMinutes, branch_id ?? null]
    );
    const [[row]] = await pool.query(`
      SELECT a.id, a.employee_id, e.full_name AS employee_name, a.date, a.check_in, a.check_out, a.status, a.late_minutes, a.overtime_minutes, a.branch_id, a.notes
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) { err(res, e); }
});
app.put('/api/attendance/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { check_out_time, status, overtime_minutes, notes } = req.body || {};
    let check_out = null;
    if (check_out_time) {
      const [[row]] = await pool.query(`SELECT date FROM attendance WHERE id = ?`, [id]);
      if (!row) return res.status(404).json({ error: 'not found' });
      const baseDate = typeof row.date === 'string'
        ? row.date
        : (row.date?.toISOString?.() ? row.date.toISOString().slice(0,10) : String(row.date));
      check_out = new Date(`${baseDate}T${check_out_time}:00`);
    }
    await pool.query(
      `UPDATE attendance SET
        check_out = COALESCE(?, check_out),
        status = COALESCE(?, status),
        overtime_minutes = COALESCE(?, overtime_minutes),
        notes = COALESCE(?, notes)
      WHERE id = ?`,
      [check_out ?? null, status ?? null, overtime_minutes ?? null, notes ?? null, id]
    );
    const [[row2]] = await pool.query(`
      SELECT a.id, a.employee_id, e.full_name AS employee_name, a.date, a.check_in, a.check_out, a.status, a.late_minutes, a.overtime_minutes, a.branch_id, a.notes
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ?`, [id]);
    ok(res, row2 || null);
  } catch (e) { err(res, e); }
});

// Leave Requests
app.get('/api/leave-requests', async (req, res) => {
  try {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    let sql = `
      SELECT lr.*, e.full_name AS employee_name, e.company_id AS employee_company_id
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
    `;
    const params = [];
    if (companyId) { sql += ` WHERE e.company_id = ?`; params.push(companyId); }
    sql += ` ORDER BY lr.id DESC`;
    const [rows] = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});
app.post('/api/leave-requests', async (req, res) => {
  try {
    const { employee_id, type, start_date, end_date, reason, notes } = req.body || {};
    if (!employee_id || !type || !start_date || !end_date) return res.status(400).json({ error: 'invalid payload' });
    const [r] = await pool.query(
      `INSERT INTO leave_requests (employee_id, type, start_date, end_date, reason, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(employee_id), type, start_date, end_date, reason || null, notes || null]
    );
    const [[row]] = await pool.query(`SELECT * FROM leave_requests WHERE id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) { err(res, e); }
});
app.put('/api/leave-requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, approved_by } = req.body || {};
    await pool.query(
      `UPDATE leave_requests SET status = COALESCE(?, status), approved_by = COALESCE(?, approved_by) WHERE id = ?`,
      [status ?? null, approved_by ?? null, id]
    );
    const [[row]] = await pool.query(`SELECT * FROM leave_requests WHERE id = ?`, [id]);
    ok(res, row || null);
  } catch (e) { err(res, e); }
});

async function start() {
  await ensureDatabase();
  pool = await mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 10,
    namedPlaceholders: true,
    dateStrings: true
  });
  await ensureTables();
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
    console.log(`Connected to MySQL ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  });
}

start().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
