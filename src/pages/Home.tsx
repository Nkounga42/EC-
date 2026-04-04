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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'blog' | 'status'>('all');
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
      } else {
        query = query.eq('post_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let postsWithLikes = data || [];
      if (profile) {
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

  useEffect(() => {
    fetchPosts();
    fetchSuggestedUsers();
  }, [filter, profile]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar - Navigation/Stats */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Explore</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="ghost" className="w-full justify-start gap-3 text-primary">
                <TrendingUp className="w-4 h-4" /> Trending
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <Users className="w-4 h-4" /> Communities
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3">
                <MessageCircle className="w-4 h-4" /> Discussions
              </Button>
            </CardContent>
          </Card>
          
          {profile && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Your Link</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">Share this link to get anonymous messages!</p>
                <div className="flex items-center gap-2">
                  <div className="bg-background border rounded p-2 text-[10px] font-mono break-all select-all cursor-pointer hover:bg-accent transition-colors flex-1">
                    {window.location.origin}/#/ngl/{profile.username}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon-xs" 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/#/ngl/${profile.username}`);
                      toast.success('Link copied!');
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
          {profile && <CreatePost onPostCreated={fetchPosts} initialContent={initialContent} />}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Feed</h2>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
              <TabsList className="grid grid-cols-3 w-[240px]">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="blog">Blogs</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>
            </Tabs>
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
              <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Suggestions/Trending */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Who to follow</CardTitle>
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
                      View
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No suggestions yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
