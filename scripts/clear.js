const { Client } = require('pg');

const connectionString = 'postgresql://postgres.edqfpzwgzrzxtwompiky:Ramcomputer15890$$@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function clearData() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query('BEGIN');

    console.log('Deleting non-admin profiles...');
    await client.query("DELETE FROM profiles WHERE role != 'admin';");

    console.log('Deleting engineers...');
    await client.query("DELETE FROM employees WHERE role = 'engineer';");

    console.log('Deleting tickets...');
    await client.query('DELETE FROM ticket_attachments;');
    await client.query('DELETE FROM ticket_comments;');
    await client.query('DELETE FROM ticket_parts;');
    await client.query('DELETE FROM ticket_status_history;');
    await client.query('DELETE FROM tickets;');
    
    console.log('Deleting parts...');
    await client.query('DELETE FROM parts_catalogue;');
    
    console.log('Deleting assets...');
    await client.query('DELETE FROM assets;');
    
    console.log('Deleting AMCs...');
    await client.query('DELETE FROM amc_contracts;');
    
    console.log('Deleting branches...');
    await client.query('DELETE FROM branches;');

    console.log('Deleting customers...');
    await client.query('DELETE FROM customers;');
    
    await client.query('COMMIT');
    console.log('Successfully cleared dummy data.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error clearing data:', err);
  } finally {
    await client.end();
  }
}

clearData();
