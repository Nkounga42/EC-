import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { ChatRoom, Message, UserProfile } from '@/src/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Plus, Search, Users, User as UserIcon, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export function Chat() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchRooms = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          room:chat_rooms(*)
        `)
        .eq('user_id', profile.id);

      if (error) throw error;
      setRooms(data?.map(d => d.room) || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users(*)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [profile]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);

      // Subscribe to real-time messages
      const channel = supabase
        .channel(`room:${selectedRoom.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`,
        }, async (payload) => {
          // Fetch sender info for the new message
          const { data: senderData } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();
          
          const newMessage = { ...payload.new, sender: senderData } as Message;
          setMessages(prev => [...prev, newMessage]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedRoom || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        room_id: selectedRoom.id,
        sender_id: profile.id,
        content: newMessage,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="container mx-auto px-4 py-8 h-[calc(100vh-8rem)]">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
        {/* Rooms List */}
        <Card className="md:col-span-4 lg:col-span-3 h-full flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-xl font-bold">Chats</CardTitle>
              <Button size="icon" variant="ghost" className="rounded-full">
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chats..." className="pl-8 h-9" />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : rooms.length > 0 ? (
                rooms.map((room) => (
                  <Button
                    key={room.id}
                    variant={selectedRoom?.id === room.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start h-16 gap-3 px-3"
                    onClick={() => setSelectedRoom(room)}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={room.image_url || ''} />
                      <AvatarFallback>
                        {room.is_group ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="font-semibold text-sm truncate w-full">
                        {room.name || 'Private Chat'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {room.is_group ? 'Group Chat' : '1-on-1'}
                      </span>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-muted-foreground">No chats yet. Start a conversation!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Window */}
        <Card className="md:col-span-8 lg:col-span-9 h-full flex flex-col overflow-hidden">
          {selectedRoom ? (
            <>
              <CardHeader className="p-4 border-b flex flex-row items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedRoom.image_url || ''} />
                  <AvatarFallback>
                    {selectedRoom.is_group ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg font-bold">{selectedRoom.name || 'Private Chat'}</CardTitle>
                  <p className="text-xs text-green-500 font-medium">Online</p>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === profile.id;
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isOwn && (
                            <Link to={`/profile/${msg.sender?.username}`}>
                              <Avatar className="h-8 w-8 mt-1 hover:opacity-80 transition-opacity">
                                <AvatarImage src={msg.sender?.avatar_url || ''} />
                                <AvatarFallback>{msg.sender?.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            </Link>
                          )}
                          <div className="flex flex-col">
                            <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                              isOwn 
                                ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                : 'bg-muted text-foreground rounded-tl-none'
                            }`}>
                              {msg.content}
                            </div>
                            <span className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Select a chat to start messaging</h3>
              <p className="text-muted-foreground max-w-sm">
                Choose a conversation from the left sidebar or start a new one with your friends.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
