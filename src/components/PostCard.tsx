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
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export function PostCard({ post }: { post: Post, key?: React.Key }) {
  const { profile } = useAuth();
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
    setIsLiked(post.is_liked || false);

    // Subscribe to real-time updates for this specific post
    const channel = supabase
      .channel(`post_updates_${post.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${post.id}`
        },
        (payload) => {
          const updatedPost = payload.new as Post;
          if (updatedPost.likes_count !== undefined) {
            setLikesCount(updatedPost.likes_count);
          }
          if (updatedPost.comments_count !== undefined) {
            setCommentsCount(updatedPost.comments_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [post.id, post.likes_count, post.is_liked, post.comments_count]);

  const handleLike = async () => {
    if (!profile) {
      toast.error('Veuillez vous connecter pour aimer les posts');
      return;
    }

    setLoading(true);
    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: profile.id, target_id: post.id, target_type: 'post' });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: profile.id, target_id: post.id, target_type: 'post' });
        
        if (error) throw error;
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const postUrl = `${window.location.origin}/#/blog/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    toast.success('Lien du post copié dans le presse-papier !');
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderMedia = (url: string) => {
    const youtubeId = getYoutubeId(url);
    if (youtubeId) {
      return (
        <div className="aspect-video w-full">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
    }

    // Spotify Support
    if (url.includes('spotify.com')) {
      let embedUrl = url;
      if (!url.includes('/embed/')) {
        // Convert regular link to embed link
        embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      }
      return (
        <div className="w-full">
          <iframe
            src={embedUrl}
            width="100%"
            height="352"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-xl"
          ></iframe>
        </div>
      );
    }

    // SoundCloud Support
    if (url.includes('soundcloud.com')) {
      let embedUrl = url;
      if (!url.includes('w.soundcloud.com/player')) {
        // Convert regular link to embed link
        embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
      }
      return (
        <div className="w-full">
          <iframe
            width="100%"
            height="300"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={embedUrl}
            className="rounded-xl"
          ></iframe>
        </div>
      );
    }

    // Check if it's an image
    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('supabase.co/storage/v1/object/public/posts/')) {
      return (
        <img 
          src={url} 
          alt="Post media" 
          className="w-full h-auto object-cover max-h-[500px]" 
          referrerPolicy="no-referrer" 
        />
      );
    }

    // Check if it's a video file
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
      return (
        <video controls className="w-full h-auto max-h-[500px]">
          <source src={url} />
          Votre navigateur ne supporte pas la lecture de vidéos.
        </video>
      );
    }

    // Check if it's an audio file
    if (url.match(/\.(mp3|wav|ogg)$/i)) {
      return (
        <div className="p-4 bg-muted rounded-lg">
          <audio controls className="w-full">
            <source src={url} />
            Votre navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      );
    }

    // Fallback for unknown links
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-2 p-4 bg-muted rounded-lg text-primary hover:underline text-sm"
      >
        <Share2 className="w-4 h-4" />
        Lien externe : {url}
      </a>
    );
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
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}
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
            {renderMedia(post.cover_image || post.media_url || '')}
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
              Lire la suite...
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
                {renderMedia(post.cover_image || post.media_url || '')}
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
            <span className="text-xs font-medium">{commentsCount}</span>
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleShare}>
          <Share2 className="w-4 h-4" />
          <span className="text-xs font-medium text-muted-foreground">Partager</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
