const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.SUPABASE_POSTGRES_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
