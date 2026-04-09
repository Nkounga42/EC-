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
import { Image as ImageIcon, Send, FileText, Type, Palette, X, Link as LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export function CreatePost({ onPostCreated, initialContent = '', className = '' }: { onPostCreated?: () => void, initialContent?: string, className?: string }) {
  const { profile } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [backgroundColor, setBackgroundColor] = useState(BG_OPTIONS[0].value);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'file' | 'url'>('file');
  const [externalUrl, setExternalUrl] = useState('');

  // Update content if initialContent changes
  React.useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 10 Mo');
        e.target.value = '';
        return;
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaFile(null);
      setMediaPreview(null);
    }
  };

  const getSpotifyEmbedUrl = (url: string) => {
    if (url.includes('/embed/')) return url;
    const regExp = /open\.spotify\.com\/(?:[a-z]{2}-[a-z]{2}\/|intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/;
    const match = url.match(regExp);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
    return url;
  };

  const handleExternalUrlChange = (val: string) => {
    // If user pastes a full iframe, try to extract the src
    if (val.includes('<iframe')) {
      const srcMatch = val.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) {
        setExternalUrl(srcMatch[1]);
        return;
      }
    }
    setExternalUrl(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!content.trim() && !mediaFile)) return;

    setLoading(true);
    try {
      let mediaUrl = null;
      if (mediaType === 'file' && mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('posts').getPublicUrl(filePath);
        mediaUrl = data.publicUrl;
      } else if (mediaType === 'url' && externalUrl.trim()) {
        mediaUrl = externalUrl.trim();
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
      setExternalUrl('');
      toast.success('Statut mis à jour !');
      if (onPostCreated) onPostCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const isMedia = !!mediaFile || (mediaType === 'url' && !!externalUrl);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <Card className={`mb-6 overflow-hidden ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">{profile.username}</p>
              <p className="text-xs text-muted-foreground">Partager une mise à jour de statut</p>
            </div>
          </div> 
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <form onSubmit={handleSubmit}>
          <div className={`rounded-lg transition-all duration-300 ${!isMedia ? backgroundColor : 'bg-background'} p-4`}>
            <Textarea
              placeholder="À quoi pensez-vous ?"
              className={`min-h-[120px] resize-none border-none focus-visible:ring-0 text-lg font-medium placeholder:text-muted-foreground/50 ${!isMedia ? `${fontFamily} ${backgroundColor === 'bg-background' ? 'text-foreground' : 'text-white'}` : 'text-foreground'}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {mediaType === 'file' && mediaPreview && (
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
            {mediaType === 'url' && externalUrl && (
              <div className="mt-2 rounded-md overflow-hidden border bg-muted p-2">
                {getYoutubeId(externalUrl) ? (
                  <div className="aspect-video">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${getYoutubeId(externalUrl)}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : externalUrl.includes('spotify.com') ? (
                  <div className="w-full">
                    <iframe
                      src={getSpotifyEmbedUrl(externalUrl)}
                      width="100%"
                      height="352"
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    ></iframe>
                  </div>
                ) : externalUrl.includes('soundcloud.com') ? (
                  <div className="w-full">
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={externalUrl.includes('w.soundcloud.com/player') ? externalUrl : `https://w.soundcloud.com/player/?url=${encodeURIComponent(externalUrl)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`}
                    ></iframe>
                  </div>
                ) : externalUrl.match(/\.(jpeg|jpg|gif|png)$/) ? (
                  <img src={externalUrl} alt="Preview" className="w-full h-auto max-h-[300px] object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <LinkIcon className="w-4 h-4" />
                    <span className="truncate">{externalUrl}</span>
                  </div>
                )}
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
      <CardFooter className="flex flex-col gap-4 pt-2">
        <div className="w-full flex items-center justify-between">
          <div className="flex gap-2">
            <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as 'file' | 'url')}>
              <TabsList className="h-8">
                <TabsTrigger value="file" className="text-xs px-2 h-7">
                  <ImageIcon className="w-3 h-3 mr-1" /> Fichier
                </TabsTrigger>
                <TabsTrigger value="url" className="text-xs px-2 h-7">
                  <LinkIcon className="w-3 h-3 mr-1" /> Lien
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mediaType === 'file' && (
              <>
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
                  className="gap-2 h-8"
                  onClick={() => document.getElementById('status-media')?.click()}
                >
                  <ImageIcon className="w-4 h-4" />
                  {mediaFile ? 'Changer' : 'Ajouter'}
                </Button>
              </>
            )}
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (!content.trim() && !mediaFile && !externalUrl)} 
            size="sm" 
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Publication...' : 'Partager le statut'}
          </Button>
        </div>

        {mediaType === 'url' && (
          <div className="w-full space-y-2">
            <Label htmlFor="external-url" className="text-xs">URL du média (YouTube, Spotify, SoundCloud, etc.)</Label>
            <Input
              id="external-url"
              placeholder="https://... ou code embed"
              value={externalUrl}
              onChange={(e) => handleExternalUrlChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
