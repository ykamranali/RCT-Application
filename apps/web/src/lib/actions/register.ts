'use server';

import { createAdminSupabase } from '@/lib/supabase/server';
import { UserRole } from '@rct/types';

export async function registerUser(data: {
  email: string;
  password?: string;
  full_name: string;
  phone?: string;
  role: 'customer_admin' | 'engineer';
  company_name?: string; // Only for customers
}) {
  const supabase = createAdminSupabase();
  const password = data.password || Math.random().toString(36).slice(-10) + 'A1!';

  // 1. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    return { error: authError.message };
  }

  const userId = authData.user.id;
  let customerId = null;
  let employeeId = null;

  try {
    if (data.role === 'customer_admin') {
      if (!data.company_name) {
        throw new Error('Company name is required for customer registration.');
      }
      // Create Customer
      const customerCode = `CUS-${Math.floor(Math.random() * 1000000)}`;
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          customer_code: customerCode,
          company_name: data.company_name,
          email: data.email,
          phone: data.phone || null,
          contact_person: data.full_name,
          status: 'active',
        })
        .select('id')
        .single();

      if (customerError) throw customerError;
      customerId = customer.id;
      
    } else if (data.role === 'engineer') {
      // Create Employee
      const employeeCode = `EMP-${Math.floor(Math.random() * 1000000)}`;
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          employee_code: employeeCode,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          role: 'engineer',
          status: 'active',
          profile_id: userId,
        })
        .select('id')
        .single();

      if (employeeError) throw employeeError;
      employeeId = employee.id;
    }

    // 2. Create Profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.role as UserRole,
        is_active: data.role === 'customer_admin', // Engineers need admin approval
        must_change_password: !data.password,
        customer_id: customerId,
        employee_id: employeeId,
      });

    if (profileError) throw profileError;

    // 3. Link Profile to Customer/Employee if needed
    if (data.role === 'customer_admin' && customerId) {
      await supabase.from('customer_users').insert({
        customer_id: customerId,
        profile_id: userId,
        is_primary: true,
      });
    }

    return { success: true, needsApproval: data.role === 'engineer' };
  } catch (error: any) {
    console.error('Registration failed:', error);
    // Best effort cleanup
    await supabase.auth.admin.deleteUser(userId);
    return { error: error.message || 'Registration failed' };
  }
}
