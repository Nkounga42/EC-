import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import MDEditor from '@uiw/react-md-editor';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { Post, Comment, UserProfile } from '@/src/types/database';
import { useAuth } from '@/src/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Heart, MessageCircle, Share2, ArrowLeft, Send, Trash2, Paperclip, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export function BlogDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (postId) {
      fetchPostData();

      // Subscribe to real-time updates for this specific post
      const channel = supabase
        .channel(`blog_post_updates_${postId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'posts',
            filter: `id=eq.${postId}`
          },
          (payload) => {
            const updatedPost = payload.new as Post;
            if (updatedPost.likes_count !== undefined) {
              setLikesCount(updatedPost.likes_count);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [postId, profile]);

  const fetchPostData = async () => {
    if (!postId) return;
    
    // Simple UUID check
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
    if (!isUUID) {
      setLoading(false);
      setPost(null);
      return;
    }
    
    setLoading(true);
    try {
      // Fetch post with author
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, author:users(*)')
        .eq('id', postId)
        .single();

      if (postError) {
        console.error('Post fetch error:', postError);
        throw postError;
      }
      
      setPost(postData);
      setLikesCount(postData.likes_count || 0);

      // Check if liked - use maybeSingle to avoid error if not found
      if (profile) {
        try {
          const { data: likeData } = await supabase
            .from('likes')
            .select('*')
            .match({ user_id: profile.id, target_id: postId, target_type: 'post' })
            .maybeSingle();
          
          setIsLiked(!!likeData);
        } catch (likeErr) {
          console.error('Error checking like status:', likeErr);
          // Don't throw here, not critical
        }
      }

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*, author:users(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('Comments fetch error:', commentsError);
        // Don't throw here, we can still show the post
      } else {
        setComments(commentsData || []);
      }
    } catch (error: any) {
      console.error('Error fetching blog post:', error);
      const message = error.message === 'Failed to fetch' 
        ? 'Erreur réseau : Impossible de se connecter à Supabase. Vérifiez votre connexion ou l\'état du projet.'
        : error.message || 'Impossible de charger l\'article de blog';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!profile) {
      toast.error('Veuillez vous connecter pour aimer les posts');
      return;
    }

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: profile.id, target_id: postId, target_type: 'post' });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: profile.id, target_id: postId, target_type: 'post' });
        
        if (error) throw error;
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      toast.error(error.message);
    }
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
        <div className="aspect-video w-full rounded-2xl overflow-hidden border shadow-xl">
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
        embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      }
      return (
        <div className="w-full rounded-2xl overflow-hidden border shadow-xl">
          <iframe
            src={embedUrl}
            width="100%"
            height="352"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
        </div>
      );
    }

    // SoundCloud Support
    if (url.includes('soundcloud.com')) {
      let embedUrl = url;
      if (!url.includes('w.soundcloud.com/player')) {
        embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
      }
      return (
        <div className="w-full rounded-2xl overflow-hidden border shadow-xl">
          <iframe
            width="100%"
            height="300"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={embedUrl}
          ></iframe>
        </div>
      );
    }

    // Check if it's an image
    if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('supabase.co/storage/v1/object/public/posts/')) {
      return (
        <div className="rounded-2xl overflow-hidden border shadow-xl">
          <img 
            src={url} 
            alt="Blog cover" 
            className="w-full h-auto object-cover max-h-[600px]" 
            referrerPolicy="no-referrer" 
          />
        </div>
      );
    }

    // Check if it's a video file
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
      return (
        <div className="rounded-2xl overflow-hidden border shadow-xl bg-black">
          <video controls className="w-full h-auto max-h-[600px] mx-auto">
            <source src={url} />
            Votre navigateur ne supporte pas la lecture de vidéos.
          </video>
        </div>
      );
    }

    // Check if it's an audio file
    if (url.match(/\.(mp3|wav|ogg)$/i)) {
      return (
        <div className="p-6 bg-muted rounded-2xl border border-dashed">
          <audio controls className="w-full">
            <source src={url} />
            Votre navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      );
    }

    return null;
  };

  const isEmbedUrl = (url: string) => {
    return (
      getYoutubeId(url) || 
      url.includes('spotify.com') || 
      url.includes('soundcloud.com')
    );
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newComment.trim()) return;

    setCommenting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: profile.id,
          content: newComment.trim()
        })
        .select('*, author:users(*)')
        .single();

      if (error) throw error;

      setComments(prev => [...prev, data]);
      setNewComment('');
      toast.success('Commentaire ajouté !');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Commentaire supprimé');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement de l'article de blog...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-md mx-auto p-8">
          <CardHeader>
            <CardTitle className="text-2xl">Article non trouvé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Cet article de blog n'existe pas ou a été supprimé.</p>
            <Button render={<Link to="/" />} className="mt-6" nativeButton={false}>
              Aller à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" className="mb-6 gap-2" render={<Link to="/" />} nativeButton={false}>
        <ArrowLeft className="w-4 h-4" /> Retour au fil d'actualité
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {post.title || "Article de blog sans titre"}
          </h1>
          <div className="flex items-center gap-4">
            <Link to={`/profile/${post.author?.username}`} className="flex items-center gap-3 group">
              <Avatar className="h-10 w-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors">
                <AvatarImage src={post.author?.avatar_url || ''} />
                <AvatarFallback>{post.author?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-sm group-hover:text-primary transition-colors">@{post.author?.username}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </Link>
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {(post.cover_image || post.media_url) && renderMedia(post.cover_image || post.media_url || '')}

        <div className="prose prose-lg dark:prose-invert max-w-none" data-color-mode="light">
          <MDEditor.Markdown source={post.content} style={{ backgroundColor: 'transparent' }} />
        </div>

        {post.media_url && !isEmbedUrl(post.media_url) && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Paperclip className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Pièce jointe</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {post.media_url.split('/').pop()}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(post.media_url!, '_blank')}>
                <Download className="w-4 h-4" /> Télécharger
              </Button>
            </CardContent>
          </Card>
        )}

        <footer className="border-t border-b py-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              size="lg" 
              className={`gap-2 rounded-full px-6 ${isLiked ? 'text-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
              onClick={handleLike}
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              <span className="font-bold">{likesCount}</span>
            </Button>
            <div className="flex items-center gap-2 text-muted-foreground px-4">
              <MessageCircle className="w-6 h-6" />
              <span className="font-bold">{comments.length}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Share2 className="w-5 h-5" />
          </Button>
        </footer>

        <section className="space-y-8">
          <h3 className="text-2xl font-bold tracking-tight">Commentaires ({comments.length})</h3>
          
          {profile ? (
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Ajouter un commentaire..." 
                  className="min-h-[100px] resize-none focus-visible:ring-primary"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={commenting || !newComment.trim()} className="gap-2 rounded-full px-6">
                    {commenting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Publier le commentaire
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground mb-4">Vous devez être connecté pour commenter.</p>
                <Button render={<Link to="/auth" />} nativeButton={false}>Se connecter</Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6 pt-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 group">
                <Link to={`/profile/${comment.author?.username}`}>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={comment.author?.avatar_url || ''} />
                    <AvatarFallback>{comment.author?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link to={`/profile/${comment.author?.username}`} className="font-bold text-sm hover:underline">
                        @{comment.author?.username}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    {(profile?.id === comment.author_id || profile?.role === 'admin') && (
                      <Button 
                        variant="ghost" 
                        size="icon-xs" 
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                        onClick={() => deleteComment(comment.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="bg-muted/50 p-4 rounded-2xl rounded-tl-none">
                    <p className="text-sm leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground italic">
                Pas encore de commentaires. Soyez le premier à partager vos pensées !
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
