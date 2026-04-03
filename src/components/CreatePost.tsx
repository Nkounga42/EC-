import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Image as ImageIcon, Send } from 'lucide-react';

export function CreatePost({ onPostCreated }: { onPostCreated?: () => void }) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'status' | 'blog'>('status');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !content.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert({
        author_id: profile.id,
        content,
        post_type: postType,
      });

      if (error) throw error;

      setContent('');
      toast.success('Post created successfully!');
      if (onPostCreated) onPostCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-sm">{profile.username}</p>
            <p className="text-xs text-muted-foreground">Sharing as {postType}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <form onSubmit={handleSubmit}>
          <Tabs value={postType} onValueChange={(v) => setPostType(v as 'status' | 'blog')} className="mb-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="blog">Blog Post</TabsTrigger>
            </TabsList>
          </Tabs>
          <Textarea
            placeholder={postType === 'status' ? "What's on your mind?" : "Write your blog post here..."}
            className="min-h-[100px] resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </form>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" className="gap-2">
          <ImageIcon className="w-4 h-4" />
          Add Media
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !content.trim()} size="sm" className="gap-2">
          <Send className="w-4 h-4" />
          {loading ? 'Posting...' : 'Post'}
        </Button>
      </CardFooter>
    </Card>
  );
}
