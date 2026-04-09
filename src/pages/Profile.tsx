import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { UserProfile, Post } from '@/src/types/database';
import { PostCard } from '@/src/components/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, MapPin, Link as LinkIcon, Edit, MessageSquare, MessageCircle, Copy, Check } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';

export function Profile() {
  const { username } = useParams<{ username: string }>();
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [copied, setCopied] = useState(false);

  const nglUrl = `${window.location.origin}/#/ngl/${username}`;

  const copyNglLink = () => {
    navigator.clipboard.writeText(nglUrl);
    setCopied(true);
    toast.success('Lien NGL copié dans le presse-papier !');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!username) return;
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .ilike('username', username)
          .single();

        if (userError) throw userError;
        if (!userData) {
          setProfile(null);
          return;
        }
        setProfile(userData);

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*, author:users(*)')
          .eq('author_id', userData.id)
          .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        
        let postsWithLikes = postsData || [];
        if (currentUser) {
          const { data: userLikes } = await supabase
            .from('likes')
            .select('target_id')
            .eq('user_id', currentUser.id)
            .eq('target_type', 'post')
            .in('target_id', postsWithLikes.map(p => p.id));
          
          const likedPostIds = new Set(userLikes?.map(l => l.target_id) || []);
          postsWithLikes = postsWithLikes.map(p => ({
            ...p,
            is_liked: likedPostIds.has(p.id)
          }));
        }
        
        setPosts(postsWithLikes);
      } catch (error: any) {
        console.error('Error fetching profile:', error.message);
        toast.error('Impossible de charger le profil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [username]);

  const startChat = async () => {
    if (!currentUser || !profile) return;
    setStartingChat(true);
    try {
      // 1. Check if a private room already exists between these two users
      const { data: existingParticipants, error: findError } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);

      if (findError) throw findError;

      const roomIds = existingParticipants?.map(p => p.room_id) || [];
      
      if (roomIds.length > 0) {
        // Check if any of these rooms also have the target user as a participant
        const { data: commonRooms, error: commonError } = await supabase
          .from('chat_participants')
          .select('room_id, room:chat_rooms(*)')
          .in('room_id', roomIds)
          .eq('user_id', profile.id);

        if (commonError) throw commonError;

        // Filter for non-group rooms
        const privateRoom = commonRooms?.find(r => !(r.room as any).is_group);

        if (privateRoom) {
          // Room exists, navigate to it
          navigate(`/chat/${privateRoom.room_id}`);
          return;
        }
      }

      // 2. Create a new room if none exists
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ is_group: false })
        .select()
        .single();

      if (roomError) throw roomError;

      // 3. Add both participants sequentially to avoid RLS issues
      const { error: selfPartError } = await supabase
        .from('chat_participants')
        .insert({ room_id: newRoom.id, user_id: currentUser.id, role: 'admin' });

      if (selfPartError) throw selfPartError;

      const { error: otherPartError } = await supabase
        .from('chat_participants')
        .insert({ room_id: newRoom.id, user_id: profile.id, role: 'member' });

      if (otherPartError) throw otherPartError;

      navigate(`/chat/${newRoom.id}`);
    } catch (error: any) {
      console.error('Error starting chat:', error.message);
      toast.error('Impossible de démarrer le chat');
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du profil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-md mx-auto p-8">
          <CardHeader>
            <CardTitle className="text-2xl">Utilisateur non trouvé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">L'utilisateur @{username} n'existe pas ou a été supprimé.</p>
            <Button render={<Link to="/" />} className="mt-6" nativeButton={false}>
              Aller à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const joinDate = new Date(profile.created_at);
  const formattedJoinDate = isValid(joinDate) ? format(joinDate, 'MMMM yyyy', { locale: fr }) : 'Récemment';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-8 overflow-hidden border-none shadow-lg">
        <div className="h-40 bg-gradient-to-r from-primary/30 via-primary/20 to-secondary/20" />
        <CardContent className="relative pt-0 pb-8 px-6 md:px-10">
          <div className="flex flex-col md:flex-row items-end gap-6 -mt-16 mb-8">
            <Avatar className="h-32 w-32 border-4 border-background ring-4 ring-primary/10 shadow-2xl">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="text-3xl font-bold bg-primary text-primary-foreground">
                {profile.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-2 text-center md:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight">{profile.username}</h1>
              <p className="text-lg text-muted-foreground">@{profile.username}</p>
            </div>
            <div className="flex gap-2 mb-2">
              <Button render={<Link to={`/ngl/${profile.username}`} />} variant="default" className="gap-2 rounded-full px-6" nativeButton={false}>
                <MessageSquare className="w-4 h-4" /> Envoyer un NGL
              </Button>
              {!isOwnProfile && (
                <Button 
                  variant="secondary" 
                  className="gap-2 rounded-full px-6"
                  onClick={startChat}
                  disabled={startingChat}
                >
                  {startingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Chat
                </Button>
              )}
              {isOwnProfile && (
                <Button variant="outline" className="gap-2 rounded-full">
                  <Edit className="w-4 h-4" /> Modifier
                </Button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">À propos</h3>
                <p className="text-lg leading-relaxed">{profile.bio || "Pas encore de bio. Cet utilisateur est un mystère !"}</p>
              </div>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Rejoint en {formattedJoinDate}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <LinkIcon className="w-5 h-5 text-primary" />
                <div className="flex items-center gap-2 overflow-hidden">
                  <Link to={`/ngl/${profile.username}`} className="text-primary hover:underline font-medium truncate">
                    {nglUrl.replace('https://', '').replace('http://', '')}
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyNglLink}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight border-b pb-2">Posts</h2>
        {posts.length > 0 ? (
          <div className="grid gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground">Pas encore de posts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
