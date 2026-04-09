import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { UserProfile, Post, AnonymousMessage } from '@/src/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, Trash2, UserX, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    fetchAdminData();
  }, [profile]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, postsRes, messagesRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('posts').select('*, author:users(*)').order('created_at', { ascending: false }),
        supabase.from('anonymous_messages').select('*').order('created_at', { ascending: false })
      ]);

      setUsers(usersRes.data || []);
      setPosts(postsRes.data || []);
      setMessages(messagesRes.data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success("Post supprimé par l'administrateur");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Accès Refusé</h1>
        <p className="text-muted-foreground">Vous n'avez pas la permission de voir cette page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Panneau de Contrôle Administrateur</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="users">Utilisateurs ({users.length})</TabsTrigger>
            <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
            <TabsTrigger value="ngl">Messages NGL ({messages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Utilisateurs</CardTitle>
                <CardDescription>Gérer les comptes utilisateurs et les rôles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted">
                      <tr>
                        <th className="px-4 py-3">Nom d'utilisateur</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Rôle</th>
                        <th className="px-4 py-3">Rejoint le</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b">
                          <td className="px-4 py-3 font-medium">
                            <Link to={`/profile/${user.username}`} className="text-primary hover:underline">
                              {user.username}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{format(new Date(user.created_at), 'd MMM yyyy', { locale: fr })}</td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <UserX className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts">
            <div className="grid gap-4">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link to={`/profile/${post.author?.username}`} className="font-bold hover:underline">
                          @{post.author?.username}
                        </Link>
                        <Badge variant="secondary">{post.post_type}</Badge>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deletePost(post.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {post.title && <h4 className="font-bold mb-1">{post.title}</h4>}
                    <p className="text-sm line-clamp-3">{post.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ngl">
            <Card>
              <CardHeader>
                <CardTitle>Audit des Messages Anonymes</CardTitle>
                <CardDescription>Les administrateurs peuvent voir l'identité de l'expéditeur à des fins de modération.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted">
                      <tr>
                        <th className="px-4 py-3">Destinataire</th>
                        <th className="px-4 py-3">Contenu</th>
                        <th className="px-4 py-3">ID de l'expéditeur</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((msg) => (
                        <tr key={msg.id} className="border-b">
                          <td className="px-4 py-3 font-medium">
                            {users.find(u => u.id === msg.recipient_id)?.username || 'Inconnu'}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate">{msg.content}</td>
                          <td className="px-4 py-3 font-mono text-[10px]">{msg.sender_id || 'Anonyme'}</td>
                          <td className="px-4 py-3">{format(new Date(msg.created_at), 'd MMM, HH:mm', { locale: fr })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
