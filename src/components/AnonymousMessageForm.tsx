import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

export function AnonymousMessageForm({ recipientId, recipientUsername }: { recipientId: string, recipientUsername: string }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      // Get IP address (mocked for now, in a real app you'd get this from the server)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const ip = ipData.ip;

      const { error } = await supabase.from('anonymous_messages').insert({
        recipient_id: recipientId,
        content,
        sender_id: user?.id || null, // Track sender if logged in, but keep it hidden from recipient
        sender_ip: ip,
        is_read: false,
      });

      if (error) throw error;

      setContent('');
      toast.success('Message sent anonymously!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gradient-to-br from-pink-500 to-orange-400 text-white border-none shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Send an anonymous message to @{recipientUsername}</CardTitle>
        <CardDescription className="text-white/80">They will never know it's you!</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Send me anonymous messages..."
            className="bg-white/20 border-white/30 text-white placeholder:text-white/60 min-h-[120px] focus-visible:ring-white/50"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <Button 
            type="submit" 
            className="w-full bg-white text-orange-500 hover:bg-white/90 font-bold py-6 text-lg rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={loading || !content.trim()}
          >
            {loading ? 'Sending...' : (
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" /> Send Message
              </span>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center justify-center pb-6">
        <p className="text-xs text-white/60">Anonymity is guaranteed. No bullying allowed.</p>
      </CardFooter>
    </Card>
  );
}
