import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Send, FileText, Type, Palette, X } from 'lucide-react';

const FONT_OPTIONS = [
  { name: 'Sans', value: 'font-sans' },
  { name: 'Serif', value: 'font-serif' },
  { name: 'Mono', value: 'font-mono' },
  { name: 'Display', value: 'font-display' },
  { name: 'Handwriting', value: 'font-handwriting' },
];

const BG_OPTIONS = [
  { name: 'Default', value: 'bg-background' },
  { name: 'Emerald', value: 'bg-emerald-600' },
  { name: 'Blue', value: 'bg-blue-600' },
  { name: 'Purple', value: 'bg-purple-600' },
  { name: 'Rose', value: 'bg-rose-600' },
  { name: 'Amber', value: 'bg-amber-600' },
  { name: 'Indigo', value: 'bg-indigo-600' },
  { name: 'Dark', value: 'bg-zinc-900' },
];

export function CreatePost({ onPostCreated, initialContent = '' }: { onPostCreated?: () => void, initialContent?: string }) {
  const { profile } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [backgroundColor, setBackgroundColor] = useState(BG_OPTIONS[0].value);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  // Update content if initialContent changes
  React.useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!content.trim() && !mediaFile)) return;

    setLoading(true);
    try {
      let mediaUrl = null;
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
        mediaUrl = data.publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
        author_id: profile.id,
        content,
        post_type: 'status',
        media_url: mediaUrl,
        font_family: mediaUrl ? null : fontFamily,
        background_color: mediaUrl ? null : backgroundColor,
      });

      if (error) throw error;

      setContent('');
      setMediaFile(null);
      setMediaPreview(null);
      toast.success('Status updated!');
      if (onPostCreated) onPostCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const isMedia = !!mediaFile;

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">{profile.username}</p>
              <p className="text-xs text-muted-foreground">Share a status update</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" render={<Link to="/create-blog" />} nativeButton={false}>
            <FileText className="w-4 h-4" /> Write Blog
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <form onSubmit={handleSubmit}>
          <div className={`rounded-lg transition-all duration-300 ${!isMedia ? backgroundColor : 'bg-background'} p-4`}>
            <Textarea
              placeholder="What's on your mind?"
              className={`min-h-[120px] resize-none border-none focus-visible:ring-0 text-lg font-medium placeholder:text-muted-foreground/50 ${!isMedia ? `${fontFamily} ${backgroundColor === 'bg-background' ? 'text-foreground' : 'text-white'}` : 'text-foreground'}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {mediaPreview && (
              <div className="relative mt-2 rounded-md overflow-hidden border">
                <img src={mediaPreview} alt="Preview" className="w-full h-auto max-h-[300px] object-cover" />
                <Button 
                  variant="destructive" 
                  size="icon-xs" 
                  className="absolute top-2 right-2 rounded-full h-6 w-6"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {!isMedia && (
            <div className="flex flex-wrap gap-4 mt-4 items-center">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.value}
                      type="button"
                      onClick={() => setFontFamily(font.value)}
                      className={`px-2 py-1 text-[10px] rounded border transition-all ${fontFamily === font.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {BG_OPTIONS.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => setBackgroundColor(bg.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${bg.value} ${backgroundColor === bg.value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:scale-110'}`}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <div className="flex gap-2">
          <input
            type="file"
            id="status-media"
            className="hidden"
            accept="image/*,video/*,audio/*"
            onChange={handleFileChange}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2"
            onClick={() => document.getElementById('status-media')?.click()}
          >
            <ImageIcon className="w-4 h-4" />
            {isMedia ? 'Change Media' : 'Add Media'}
          </Button>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={loading || (!content.trim() && !mediaFile)} 
          size="sm" 
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Posting...' : 'Share Status'}
        </Button>
      </CardFooter>
    </Card>
  );
}
