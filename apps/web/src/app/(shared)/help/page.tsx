'use client';

import { useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Message = {
  role: 'bot' | 'user';
  content: string;
};

const INITIAL_MESSAGES: Message[] = [
  { role: 'bot', content: 'Hello! I am Omni Bot, your virtual assistant for the RCT Application. How can I help you today?' },
  { role: 'bot', content: 'You can ask me about creating tickets, viewing reports, or navigating the platform. If I cannot help, you can request human assistance.' }
];

export default function HelpPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);
    
    // Simple rule-based bot for demonstration
    setTimeout(() => {
      setIsTyping(false);
      let response = "I'm still learning! If you need immediate assistance, please click 'Request Human Help' below to escalate to the support team.";
      
      const lowerInput = userMsg.toLowerCase();
      if (lowerInput.includes('ticket')) {
        response = "To create a ticket, navigate to the 'Tickets' page and click 'New Ticket'. Fill in the details and submit!";
      } else if (lowerInput.includes('report') || lowerInput.includes('analytics')) {
        response = "You can view your data in the 'Analytics' and 'Reports' sections. Reports can be exported as PDF.";
      } else if (lowerInput.includes('amc')) {
        response = "Annual Maintenance Contracts (AMC) can be viewed in the 'AMC Contracts' section to track expiration and SLAs.";
      } else if (lowerInput.includes('profile') || lowerInput.includes('password')) {
        response = "You can update your personal info by visiting the 'Profile' section from the bottom of the sidebar.";
      }
      
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    }, 1000);
  };

  const requestHumanHelp = async () => {
    try {
      const supabase = createBrowserSupabase();
      
      // Get a super admin to notify
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1);
        
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert({
          profile_id: admins[0].id,
          title: 'Help Request Escalate',
          body: 'A user has requested human assistance via Omni Bot.',
          severity: 'warning',
          link_url: '/admin/users'
        });
        toast.success("Help request sent to administrators.");
      } else {
        toast.error("Could not find an administrator to notify.");
      }
    } catch (err: any) {
      toast.error("Error sending help request.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <PageHeader
        title="Help & Support"
        description="Get assistance from Omni Bot or escalate to an administrator."
      />
      
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="flex-none">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Omni Bot
          </CardTitle>
          <CardDescription>Automated assistance for the RCT Application</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden relative p-0">
          <ScrollArea className="h-full px-6 py-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  
                  <div className={`rounded-lg px-4 py-2 max-w-[75%] ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground'
                  }`}>
                    {msg.content}
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-muted text-muted-foreground flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        
        <CardFooter className="flex-none flex flex-col gap-3 p-4 border-t">
          <form 
            className="flex w-full gap-2"
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          >
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..." 
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          <div className="w-full flex justify-center">
            <Button variant="ghost" size="sm" onClick={requestHumanHelp} className="text-xs text-muted-foreground hover:text-foreground">
              Request Human Help
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
