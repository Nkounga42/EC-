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

  useEffect(() => {
    setLikesCount(post.likes_count || 0);
    setIsLiked(post.is_liked || false);
  }, [post.likes_count, post.is_liked]);

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

  const handleShare = () => {
    const postUrl = `${window.location.origin}/#/blog/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    toast.success('Post link copied to clipboard!');
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
        {post.post_type === 'blog' && (post.cover_image || post.media_url) && (
          <div className="mb-3 rounded-lg overflow-hidden border">
            <img 
              src={post.cover_image || post.media_url || ''} 
              alt="Blog cover" 
              className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500" 
              referrerPolicy="no-referrer" 
            />
          </div>
        )}
        {post.post_type === 'blog' ? (
          <div className="space-y-3">
            {post.title && (
              <Link to={`/blog/${post.id}`} className="block group">
                <h3 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
              </Link>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3">
              <p className="whitespace-pre-wrap">{post.content}</p>
            </div>
            <Button variant="link" className="p-0 h-auto text-primary" render={<Link to={`/blog/${post.id}`} />} nativeButton={false}>
              Read more...
            </Button>
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {post.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={`rounded-lg p-4 ${post.background_color || ''} ${post.background_color && post.background_color !== 'bg-background' ? 'text-white' : 'text-foreground'}`}>
              <p className={`text-base whitespace-pre-wrap ${post.font_family || ''}`}>
                {post.content}
              </p>
            </div>
            {(post.cover_image || post.media_url) && (
              <div className="mt-3 rounded-lg overflow-hidden border">
                <img 
                  src={post.cover_image || post.media_url || ''} 
                  alt="Post media" 
                  className="w-full h-auto object-cover max-h-[500px]" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            )}
          </>
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
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleShare}>
          <Share2 className="w-4 h-4" />
          <span className="text-xs font-medium text-muted-foreground">Share</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
