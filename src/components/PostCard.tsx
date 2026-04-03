import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post, UserProfile } from '@/src/types/database';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export function PostCard({ post }: { post: Post, key?: React.Key }) {
  const { profile } = useAuth();
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (!profile) {
      toast.error('Please sign in to like posts');
      return;
    }

    setLoading(true);
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: profile.id, target_id: post.id, target_type: 'post' });
        
        if (error) throw error;
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: profile.id, target_id: post.id, target_type: 'post' });
        
        if (error) throw error;
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author?.username}`}>
            <Avatar className="h-10 w-10 hover:opacity-80 transition-opacity">
              <AvatarImage src={post.author?.avatar_url || ''} />
              <AvatarFallback>{post.author?.username?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex flex-col">
            <Link to={`/profile/${post.author?.username}`} className="text-sm font-semibold leading-none hover:underline">
              {post.author?.username}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pb-3">
        {post.post_type === 'blog' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{post.content}</p>
          </div>
        ) : (
          <p className="text-base whitespace-pre-wrap">{post.content}</p>
        )}
        {post.media_url && (
          <div className="mt-3 rounded-lg overflow-hidden border">
            <img src={post.media_url} alt="Post media" className="w-full h-auto object-cover max-h-[500px]" referrerPolicy="no-referrer" />
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`gap-2 ${isLiked ? 'text-red-500 hover:text-red-600' : ''}`}
            onClick={handleLike}
            disabled={loading}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-xs font-medium">{likesCount}</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">{post.comments_count || 0}</span>
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          <span className="text-xs font-medium text-muted-foreground">Share</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
