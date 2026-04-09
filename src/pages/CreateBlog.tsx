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
import { Loader2, Image as ImageIcon, FileText, Send, ArrowLeft, Paperclip, Link as LinkIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export function CreateBlog() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<string | undefined>('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'file' | 'url'>('file');
  const [externalUrl, setExternalUrl] = useState('');

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('L\'image de couverture ne doit pas dépasser 10 Mo');
        return;
      }
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('La pièce jointe ne doit pas dépasser 10 Mo');
        e.target.value = ''; // Reset input
        return;
      }
      setMediaFile(file);
    } else {
      setMediaFile(null);
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

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
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
    if (!profile) {
      toast.error('Vous devez être connecté pour créer un article de blog');
      return;
    }
    if (!title.trim() || !content?.trim()) {
      toast.error('Le titre et le contenu sont requis');
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
          toast.error("Échec du téléchargement de l'image de couverture. Continuation sans elle.");
        }
      }

      if (mediaFile && mediaType === 'file') {
        try {
          mediaUrl = await uploadFile(mediaFile, 'attachments');
        } catch (err) {
          console.error('Media upload failed:', err);
          toast.error('Échec du téléchargement de la pièce jointe. Continuation sans elle.');
        }
      } else if (externalUrl.trim() && mediaType === 'url') {
        mediaUrl = externalUrl.trim();
      }

      const { data, error } = await supabase.from('posts').insert({
        author_id: profile.id,
        title: title.trim(),
        content: content.trim(),
        post_type: 'blog',
        cover_image: coverImageUrl,
        media_url: mediaUrl,
        tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      }).select().single();

      if (error) throw error;

      toast.success('Article de blog publié avec succès !');
      navigate(`/blog/${data.id}`);
    } catch (error: any) {
      console.error('Error creating blog:', error);
      toast.error(error.message || "Échec de la création de l'article de blog");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Authentification Requise</CardTitle>
            <CardDescription>Veuillez vous connecter pour créer un article de blog.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')}>Se connecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Créer un nouvel article de blog</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contenu de l'article</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    placeholder="Entrez un titre accrocheur..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold h-12"
                    required
                  />
                </div>
                <div className="space-y-2" data-color-mode="light">
                  <Label>Contenu (Markdown)</Label>
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
                <CardTitle>Médias & Paramètres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cover Image */}
                <div className="space-y-2">
                  <Label>Image de couverture</Label>
                  <div 
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent transition-colors relative h-40 flex flex-col items-center justify-center overflow-hidden"
                    onClick={() => document.getElementById('cover-input')?.click()}
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Cliquez pour télécharger une couverture</span>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Pièce jointe / Média</Label>
                    <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as 'file' | 'url')}>
                      <TabsList className="h-8">
                        <TabsTrigger value="file" className="text-xs px-2 h-7">
                          <Paperclip className="w-3 h-3 mr-1" /> Fichier
                        </TabsTrigger>
                        <TabsTrigger value="url" className="text-xs px-2 h-7">
                          <LinkIcon className="w-3 h-3 mr-1" /> Lien
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {mediaType === 'file' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          id="media-file"
                          type="file"
                          onChange={handleMediaChange}
                          className="cursor-pointer"
                        />
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                      </div>
                      {mediaFile && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          Sélectionné : {mediaFile.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="URL du média (YouTube, Spotify, SoundCloud, etc.)"
                        value={externalUrl}
                        onChange={(e) => handleExternalUrlChange(e.target.value)}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Collez un lien ou un code embed (YouTube, Spotify, SoundCloud, etc.).
                      </p>
                      
                      {/* Preview for URL */}
                      {externalUrl && (
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
                                height="152"
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
                          ) : externalUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                            <img src={externalUrl} alt="Preview" className="w-full h-auto max-h-[200px] object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                              <LinkIcon className="w-4 h-4" />
                              <span className="truncate">{externalUrl}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
                  <Input
                    id="tags"
                    placeholder="tech, lifestyle, actualités..."
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 gap-2 text-lg font-bold" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Publication...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Publier l'article
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm">Conseils</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Utilisez le Markdown pour un formatage riche.</p>
                <p>• Une bonne image de couverture augmente l'engagement.</p>
                <p>• Vous pouvez joindre des fichiers que vos lecteurs pourront télécharger.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
