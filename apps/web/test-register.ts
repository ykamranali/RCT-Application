import { registerUser } from './src/lib/actions/register';

async function test() {
  console.log('Testing customer registration...');
  const res1 = await registerUser({
    email: 'test_customer_' + Date.now() + '@example.com',
    full_name: 'Test Customer',
    role: 'customer_admin',
    company_name: 'Test Co',
  });
  console.log('Customer result:', res1);

  console.log('Testing engineer registration...');
  const res2 = await registerUser({
    email: 'test_engineer_' + Date.now() + '@example.com',
    full_name: 'Test Engineer',
    role: 'engineer',
  });
  console.log('Engineer result:', res2);
}

test().catch(console.error);
