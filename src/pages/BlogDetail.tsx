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
        ? 'Network error: Could not connect to Supabase. Check your connection or project status.'
        : error.message || 'Could not load blog post';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!profile) {
      toast.error('Please sign in to like posts');
      return;
    }

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: profile.id, target_id: postId, target_type: 'post' });
        
        if (error) throw error;
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: profile.id, target_id: postId, target_type: 'post' });
        
        if (error) throw error;
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
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
      toast.success('Comment added!');
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
      toast.success('Comment deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading blog post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-md mx-auto p-8">
          <CardHeader>
            <CardTitle className="text-2xl">Post not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This blog post doesn't exist or has been removed.</p>
            <Button render={<Link to="/" />} className="mt-6" nativeButton={false}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" className="mb-6 gap-2" render={<Link to="/" />} nativeButton={false}>
        <ArrowLeft className="w-4 h-4" /> Back to Feed
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {post.title || "Untitled Blog Post"}
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
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {(post.cover_image || post.media_url) && (
          <div className="rounded-2xl overflow-hidden border shadow-xl">
            <img 
              src={post.cover_image || post.media_url || ''} 
              alt="Blog cover" 
              className="w-full h-auto object-cover max-h-[600px]" 
              referrerPolicy="no-referrer" 
            />
          </div>
        )}

        <div className="prose prose-lg dark:prose-invert max-w-none" data-color-mode="light">
          <MDEditor.Markdown source={post.content} style={{ backgroundColor: 'transparent' }} />
        </div>

        {post.media_url && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Paperclip className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Attachment</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {post.media_url.split('/').pop()}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(post.media_url!, '_blank')}>
                <Download className="w-4 h-4" /> Download
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
          <h3 className="text-2xl font-bold tracking-tight">Comments ({comments.length})</h3>
          
          {profile ? (
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                <Textarea 
                  placeholder="Add a comment..." 
                  className="min-h-[100px] resize-none focus-visible:ring-primary"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={commenting || !newComment.trim()} className="gap-2 rounded-full px-6">
                    {commenting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post Comment
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground mb-4">You need to be signed in to comment.</p>
                <Button render={<Link to="/auth" />} nativeButton={false}>Sign In</Button>
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
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
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
                No comments yet. Be the first to share your thoughts!
              </div>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
