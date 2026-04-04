import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Image as ImageIcon, FileText, Send, ArrowLeft, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

export function CreateBlog() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    // Try to upload to 'posts' bucket
    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message === 'Bucket not found') {
        // If 'posts' bucket doesn't exist, try 'media' bucket as a fallback
        const { error: mediaError } = await supabase.storage
          .from('media')
          .upload(filePath, file);
        
        if (mediaError) {
          if (mediaError.message === 'Bucket not found') {
            throw new Error('Storage bucket "posts" or "media" not found. Please create a public bucket named "posts" in your Supabase dashboard.');
          }
          throw mediaError;
        }
        
        const { data } = supabase.storage.from('media').getPublicUrl(filePath);
        return data.publicUrl;
      }
      throw uploadError;
    }

    const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('You must be logged in to create a blog post');
      return;
    }
    if (!title.trim() || !content?.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setLoading(true);
    try {
      let coverImageUrl = null;
      let mediaUrl = null;

      if (coverImage) {
        try {
          coverImageUrl = await uploadFile(coverImage, 'covers');
        } catch (err) {
          console.error('Cover upload failed:', err);
          toast.error('Failed to upload cover image. Continuing without it.');
        }
      }

      if (mediaFile) {
        try {
          mediaUrl = await uploadFile(mediaFile, 'attachments');
        } catch (err) {
          console.error('Media upload failed:', err);
          toast.error('Failed to upload attachment. Continuing without it.');
        }
      }

      const { data, error } = await supabase.from('posts').insert({
        author_id: profile.id,
        title: title.trim(),
        content: content.trim(),
        post_type: 'blog',
        cover_image: coverImageUrl,
        media_url: mediaUrl,
      }).select().single();

      if (error) throw error;

      toast.success('Blog post published successfully!');
      navigate(`/blog/${data.id}`);
    } catch (error: any) {
      console.error('Error creating blog:', error);
      toast.error(error.message || 'Failed to create blog post');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to create a blog post.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Blog Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter a catchy title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold h-12"
                    required
                  />
                </div>
                <div className="space-y-2" data-color-mode="light">
                  <Label>Content (Markdown)</Label>
                  <MDEditor
                    value={content}
                    onChange={setContent}
                    height={400}
                    preview="edit"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Settings Area */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Media & Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cover Image */}
                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div 
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent transition-colors relative h-40 flex flex-col items-center justify-center overflow-hidden"
                    onClick={() => document.getElementById('cover-input')?.click()}
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Click to upload cover</span>
                      </>
                    )}
                    <input 
                      id="cover-input" 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleCoverChange} 
                    />
                  </div>
                </div>

                {/* Attachment */}
                <div className="space-y-2">
                  <Label htmlFor="media-file">Attachment (Media File)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="media-file"
                      type="file"
                      onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                    />
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </div>
                  {mediaFile && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      Selected: {mediaFile.name}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gap-2 text-lg font-bold" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Publish Post
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm">Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Use Markdown for rich formatting.</p>
                <p>• A good cover image increases engagement.</p>
                <p>• You can attach files for your readers to download.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
