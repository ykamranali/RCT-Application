'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { updateSettingsBatch } from '@/lib/actions/settings';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SettingsForm({ settings }: { settings: Record<string, any> }) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize state with default values from database
  const [values, setValues] = useState({
    company_name: settings.company_name || '',
    support_email: settings.support_email || '',
    support_phone: settings.support_phone || '',
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '',
    smtp_secure: settings.smtp_secure || '',
    smtp_username: settings.smtp_username || '',
    smtp_password: '', // Never populate password
    email_from: settings.email_from || '',
  });

  const handleSave = async (category: string) => {
    setIsLoading(true);
    let payload: Record<string, any> = {};

    if (category === 'company') {
      payload = {
        company_name: values.company_name,
        company_email: values.support_email, // Using support_email for company_email here to match
        company_phone: values.support_phone,
      };
    } else if (category === 'smtp') {
      payload = {
        smtp_host: values.smtp_host,
        smtp_port: values.smtp_port,
        smtp_secure: values.smtp_secure,
        smtp_username: values.smtp_username,
        email_from: values.email_from,
      };
      if (values.smtp_password) {
        payload.smtp_password = values.smtp_password;
      }
    }

    try {
      const result = await updateSettingsBatch(payload);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Settings updated successfully');
        if (category === 'smtp') {
          // Clear password field after save
          setValues(prev => ({ ...prev, smtp_password: '' }));
        }
      }
    } catch (e) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Update the primary company information used in reports and emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input 
              id="companyName" 
              value={values.company_name} 
              onChange={e => setValues(prev => ({ ...prev, company_name: e.target.value }))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input 
              id="supportEmail" 
              value={values.support_email} 
              onChange={e => setValues(prev => ({ ...prev, support_email: e.target.value }))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportPhone">Support Phone</Label>
            <Input 
              id="supportPhone" 
              value={values.support_phone} 
              onChange={e => setValues(prev => ({ ...prev, support_phone: e.target.value }))} 
            />
          </div>
          <Button onClick={() => handleSave('company')} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Details
          </Button>
        </CardContent>
      </Card>

      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>Configure the mail server used to dispatch emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input 
                id="smtpHost" 
                value={values.smtp_host} 
                onChange={e => setValues(prev => ({ ...prev, smtp_host: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input 
                id="smtpPort" 
                value={values.smtp_port} 
                onChange={e => setValues(prev => ({ ...prev, smtp_port: e.target.value }))} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpSecure">Security (tls/ssl/none)</Label>
            <Input 
              id="smtpSecure" 
              value={values.smtp_secure} 
              onChange={e => setValues(prev => ({ ...prev, smtp_secure: e.target.value }))} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Username</Label>
              <Input 
                id="smtpUser" 
                value={values.smtp_username} 
                onChange={e => setValues(prev => ({ ...prev, smtp_username: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPass">Password</Label>
              <Input 
                id="smtpPass" 
                type="password"
                placeholder="Leave blank to keep current"
                value={values.smtp_password} 
                onChange={e => setValues(prev => ({ ...prev, smtp_password: e.target.value }))} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailFrom">From Address</Label>
            <Input 
              id="emailFrom" 
              placeholder="noreply@ramtechuae.com"
              value={values.email_from} 
              onChange={e => setValues(prev => ({ ...prev, email_from: e.target.value }))} 
            />
          </div>
          <Button onClick={() => handleSave('smtp')} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save SMTP Settings
          </Button>
        </CardContent>
      </Card>
      
      {/* SLA Engine */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Engine</CardTitle>
          <CardDescription>Global SLA configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">System Timezone</Label>
            <Input id="timezone" defaultValue={settings.timezone || 'Asia/Dubai'} disabled />
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            Detailed SLA rules and calendars are managed in the SLA monitor section.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
