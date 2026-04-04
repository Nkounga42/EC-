import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { UserProfile } from '@/src/types/database';
import { AnonymousMessageForm } from '@/src/components/AnonymousMessageForm';
import { Loader2, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function NGLPage() {
  const { username } = useParams<{ username: string }>();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRecipient = async () => {
      if (!username) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('username', username)
          .single();

        if (error) throw error;
        setRecipient(data);
      } catch (err) {
        console.error('Error fetching recipient:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipient();
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !recipient) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <UserX className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>User not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">The user @{username} doesn't exist or has disabled their anonymous link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <AnonymousMessageForm recipientId={recipient.id} recipientUsername={recipient.username} />
    </div>
  );
}
