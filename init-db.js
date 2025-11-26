const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initializeDatabase() {
    try {
        console.log('Connecting to PostgreSQL...');
        console.log('Database URL:', process.env.DATABASE_URL?.replace(/:(.*?)@/, ':****@')); // Hide password

        // Create users table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          mobile_number VARCHAR(15) UNIQUE,
          role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✓ Users table created');

        // Create clients table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
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
      )
    `);
        console.log('✓ Clients table created');

        // Create default admin user
        const hashedPassword = await bcrypt.hash('123', 10);
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING`,
            ['admin', hashedPassword, 'المشرف العام', 'admin']
        );
        console.log('✓ Admin user created (username: admin, password: 123)');

        console.log('\n✅ Database initialization complete!');
        await pool.end();
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

initializeDatabase();
