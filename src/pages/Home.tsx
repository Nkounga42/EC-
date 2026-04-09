import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Post, UserProfile } from '@/src/types/database';
import { PostCard } from '@/src/components/PostCard';
import { CreatePost } from '@/src/components/CreatePost';
import { StatusTray } from '@/src/components/StatusTray';
import { useAuth } from '@/src/contexts/AuthContext';
import { Loader2, TrendingUp, Users, MessageCircle, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

export function Home() {
  const { profile } = useAuth();
  const location = useLocation();
  const initialContent = location.state?.initialContent || '';
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:users(*)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'all') {
        query = query.neq('post_type', 'status');
      } else if (filter === 'status') {
        query = query.eq('post_type', 'status');
      } else {
        // It's a category/tag
        query = query.eq('post_type', 'blog').contains('tags', [filter]);
      }

      const { data, error } = await query;

      if (error) throw error;

      let postsWithLikes = data || [];
      if (profile && postsWithLikes.length > 0) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('target_id')
          .eq('user_id', profile.id)
          .eq('target_type', 'post')
          .in('target_id', postsWithLikes.map(p => p.id));
        
        const likedPostIds = new Set(userLikes?.map(l => l.target_id) || []);
        postsWithLikes = postsWithLikes.map(p => ({
          ...p,
          is_liked: likedPostIds.has(p.id)
        }));
      }

      setPosts(postsWithLikes);
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error fetching posts:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedUsers = async () => {
    try {
      let query = supabase.from('users').select('*');
      
      if (profile?.id) {
        query = query.neq('id', profile.id);
      }
      
      const { data, error } = await query.limit(5);

      if (error) throw error;
      setSuggestedUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching suggested users:', error.message);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('tags')
        .eq('post_type', 'blog');
      
      if (error) throw error;
      
      const allTags = data?.flatMap(p => p.tags || []) || [];
      const uniqueTags = Array.from(new Set(allTags)).sort();
      setCategories(uniqueTags);
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchSuggestedUsers();
    fetchCategories();
  }, [filter, profile]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar - Navigation/Stats */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Explorer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-primary">
                <TrendingUp className="w-4 h-4" /> Tendances
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Users className="w-4 h-4" /> Communautés
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <MessageCircle className="w-4 h-4" /> Discussions
              </Button>
            </CardContent>
          </Card>
          
          {profile && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Votre Lien</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">Partagez ce lien pour recevoir des messages anonymes !</p>
                <div className="flex items-center gap-2">
                  <div className="bg-background border rounded p-2 text-[10px] font-mono break-all select-all cursor-pointer hover:bg-accent transition-colors flex-1">
                    {window.location.origin}/#/ngl/{profile.username}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon-xs" 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://ais-pre-ba6w5osgwkenrhsrvhfga5-36828778751.europe-west2.run.app//#/ngl/${profile.username}`);
                      toast.success('Lien copié !');
                    }}
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Feed */}
        <div className="col-span-1 lg:col-span-6 space-y-6">
          <StatusTray refreshTrigger={refreshTrigger} />
           

          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Fil d'actualité</h2>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setFilter('all')}
                className="rounded-full px-6 shrink-0"
              >
                Tout
              </Button> 
              {categories.map(category => (
                <Button 
                  key={category}
                  variant={filter === category ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setFilter(category)}
                  className="rounded-full px-6 shrink-0"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Aucun post pour le moment. Soyez le premier à partager quelque chose !</p>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Suggestions/Trending */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Qui suivre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2">
                    <Link to={`/profile/${user.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity overflow-hidden">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold truncate">{user.username}</span>
                        <span className="text-[10px] text-muted-foreground truncate">@{user.username}</span>
                      </div>
                    </Link>
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs rounded-full" render={<Link to={`/profile/${user.username}`} />} nativeButton={false}>
                      Voir
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucune suggestion pour le moment.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
