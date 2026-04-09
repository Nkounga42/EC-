import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { AnonymousMessage } from '@/src/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Inbox, Trash2, Eye, MessageCircle, ShieldAlert, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export function AnonymousInbox() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('anonymous_messages')
        .select('*')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('anonymous_messages')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('anonymous_messages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message supprimé');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!profile) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Boîte de réception anonyme</h1>
          <p className="text-muted-foreground">Messages qui vous ont été envoyés via votre lien public.</p>
        </div>
        <Badge variant="outline" className="text-lg py-1 px-3">
          {messages.filter(m => !m.is_read).length} Nouveau
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : messages.length > 0 ? (
        <div className="grid gap-4">
          {messages.map((message) => (
            <Card key={message.id} className={`transition-all ${!message.is_read ? 'border-primary/50 bg-primary/5' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.role === 'admin' && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3 h-3" /> Vue Administrateur
                      </Badge>
                    )}
                    {!message.is_read && <Badge>Nouveau</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-lg font-medium italic">"{message.content}"</p>
                
                {profile.role === 'admin' && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-xs space-y-1">
                    <p className="font-bold text-destructive">TRAÇABILITÉ ADMIN :</p>
                    <p><span className="font-semibold">ID de l'expéditeur :</span> {message.sender_id || 'Anonyme'}</p>
                  </div>
                )}
              </CardContent>
              <div className="px-6 pb-4 flex justify-end gap-2">
                {!message.is_read && (
                  <Button variant="ghost" size="sm" onClick={() => markAsRead(message.id)}>
                    <Eye className="w-4 h-4 mr-2" /> Marquer comme lu
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => {
                    // Navigate to home with a pre-filled post content
                    const replyText = `Réponse à un message anonyme : "${message.content}"\n\nMa réponse : `;
                    navigate('/', { state: { initialContent: replyText } });
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Répondre
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMessage(message.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>Pas encore de messages</CardTitle>
            <CardDescription>
              Partagez votre lien pour commencer à recevoir des messages anonymes !
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all select-all cursor-pointer flex-1">
                {window.location.origin}/#/ngl/{profile.username}
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#/ngl/${profile.username}`);
                  toast.success('Lien copié dans le presse-papier !');
                }}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
