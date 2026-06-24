const{Pool}=require('pg');
require('dotenv').config();

const pool= new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {rejectUnauthorized: false},
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error',(err)=>{
  console.error('unexpected error on idle PG client', err);

});

module.exports= pool;
