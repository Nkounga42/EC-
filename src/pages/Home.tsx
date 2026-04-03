import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Post } from '@/src/types/database';
import { PostCard } from '@/src/components/PostCard';
import { CreatePost } from '@/src/components/CreatePost';
import { useAuth } from '@/src/contexts/AuthContext';
import { Loader2, TrendingUp, Users, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Home() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'blog' | 'status'>('all');

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

      if (filter !== 'all') {
        query = query.eq('post_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error fetching posts:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [filter]);

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
                <div className="bg-background border rounded p-2 text-[10px] font-mono break-all select-all cursor-pointer hover:bg-accent transition-colors">
                  {window.location.origin}/#/ngl/{profile.username}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Feed */}
        <div className="col-span-1 lg:col-span-6 space-y-6">
          {profile && <CreatePost onPostCreated={fetchPosts} />}

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
              <p className="text-sm text-muted-foreground">Coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
