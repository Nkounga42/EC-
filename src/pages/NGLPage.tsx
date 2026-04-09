import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { UserProfile } from '@/src/types/database';
import { AnonymousMessageForm } from '@/src/components/AnonymousMessageForm';
import { Loader2, UserX, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function NGLPage() {
  const { username } = useParams<{ username: string }>();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const nglUrl = `${window.location.origin}/#/ngl/${username}`;

  const copyNglLink = () => {
    navigator.clipboard.writeText(nglUrl);
    setCopied(true);
    toast.success('Lien NGL copié dans le presse-papier !');
    setTimeout(() => setCopied(false), 2000);
  };

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
            <CardTitle>Utilisateur non trouvé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">L'utilisateur @{username} n'existe pas ou a désactivé son lien anonyme.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center gap-6">
        <AnonymousMessageForm recipientId={recipient.id} recipientUsername={recipient.username} />
        
        <Button 
          variant="outline" 
          className="rounded-full gap-2 bg-white/50 backdrop-blur"
          onClick={copyNglLink}
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          Copier mon lien NGL
        </Button>
      </div>
    </div>
  );
}
