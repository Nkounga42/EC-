import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { ChatRoom, Message, UserProfile } from '@/src/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, Send, Plus, Search, Users, User as UserIcon, 
  MessageSquare, ArrowLeft, MoreVertical, Phone, Video, 
  Smile, Paperclip, Mic, Check, CheckCheck, Pin, X, CornerUpRight,
  UserPlus, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface RoomWithParticipants extends ChatRoom {
  participants?: { user: UserProfile }[];
}

export function Chat() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithParticipants[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithParticipants | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New Chat / Group States
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const fetchRooms = async () => {
    if (!profile) return;
    try {
      const { data: participantData, error: partError } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', profile.id);

      if (partError) throw partError;

      const roomIds = participantData?.map(p => p.room_id) || [];

      if (roomIds.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_participants(
            user:users(*)
          )
        `)
        .in('id', roomIds)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);

      if (roomId) {
        const room = data?.find(r => r.id === roomId);
        if (room) setSelectedRoom(room);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users(*),
          reply_to:messages(*)
        `)
        .eq('room_id', id)
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
    if (roomId && rooms.length > 0) {
      const room = rooms.find(r => r.id === roomId);
      if (room) setSelectedRoom(room);
    }
  }, [roomId, rooms]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);

      const channel = supabase
        .channel(`room:${selectedRoom.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`,
        }, async (payload) => {
          const { data: senderData } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();
          
          let replyToData = null;
          if (payload.new.reply_to_id) {
            const { data } = await supabase
              .from('messages')
              .select('*')
              .eq('id', payload.new.reply_to_id)
              .single();
            replyToData = data;
          }

          const msg = { ...payload.new, sender: senderData, reply_to: replyToData } as Message;
          setMessages(prev => {
            // Check if message already exists by ID
            if (prev.some(m => m.id === msg.id)) return prev;
            
            // If it's our own message, try to find and replace the optimistic one
            if (msg.sender_id === profile?.id) {
              const optimisticIdx = prev.findIndex(m => 
                m.id.toString().startsWith('temp-') && 
                m.content === msg.content
              );
              if (optimisticIdx !== -1) {
                const newMessages = [...prev];
                newMessages[optimisticIdx] = msg;
                return newMessages;
              }
            }
            
            return [...prev, msg];
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${selectedRoom.id}`,
        }, (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
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

  // Search users for new chat
  useEffect(() => {
    const searchUsers = async () => {
      setSearchingUsers(true);
      try {
        let query = supabase
          .from('users')
          .select('*')
          .neq('id', profile?.id)
          .limit(20);
        
        if (userSearch.trim()) {
          query = query.ilike('username', `%${userSearch}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        setFoundUsers(data || []);
      } catch (error: any) {
        console.error(error.message);
      } finally {
        setSearchingUsers(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [userSearch, profile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedRoom || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      room_id: selectedRoom.id,
      sender_id: profile.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender: profile,
      reply_to: replyingTo || undefined,
      reply_to_id: replyingTo?.id || null,
      is_read: false,
    };

    // Optimistically update UI
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setReplyingTo(null);
    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: profile.id,
          content: messageContent,
          reply_to_id: replyingTo?.id || null
        })
        .select(`
          *,
          sender:users(*),
          reply_to:messages(*)
        `)
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      if (data) {
        setMessages(prev => {
          // If the message with real ID already exists (from Realtime), remove the temp one
          if (prev.some(m => m.id === data.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          // Otherwise replace the temp one with the real one
          return prev.map(m => m.id === tempId ? data as Message : m);
        });
      }
    } catch (error: any) {
      toast.error(error.message);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent); // Restore message content
    } finally {
      setSending(false);
    }
  };

  const startPrivateChat = async (targetUser: UserProfile) => {
    if (!profile) return;
    setCreatingRoom(true);
    try {
      // Check if room exists
      const { data: existingParticipants } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', profile.id);

      const roomIds = existingParticipants?.map(p => p.room_id) || [];
      
      if (roomIds.length > 0) {
        const { data: commonRooms } = await supabase
          .from('chat_participants')
          .select('room_id, room:chat_rooms(*)')
          .in('room_id', roomIds)
          .eq('user_id', targetUser.id);

        const privateRoom = commonRooms?.find(r => !(r.room as any).is_group);
        if (privateRoom) {
          setIsNewChatOpen(false);
          navigate(`/chat/${privateRoom.room_id}`);
          return;
        }
      }

      // Create new room
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ is_group: false })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add participants sequentially
      const { error: selfPartError } = await supabase
        .from('chat_participants')
        .insert({ room_id: newRoom.id, user_id: profile.id, role: 'admin' });
      
      if (selfPartError) throw selfPartError;

      const { error: otherPartError } = await supabase
        .from('chat_participants')
        .insert({ room_id: newRoom.id, user_id: targetUser.id, role: 'member' });

      if (otherPartError) throw otherPartError;

      setIsNewChatOpen(false);
      fetchRooms();
      navigate(`/chat/${newRoom.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreatingRoom(false);
    }
  };

  const createGroupChat = async () => {
    if (!profile || !groupName.trim() || selectedUsersForGroup.length === 0) return;
    setCreatingRoom(true);
    try {
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ 
          name: groupName.trim(), 
          is_group: true 
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add admin first
      const { error: adminError } = await supabase
        .from('chat_participants')
        .insert({ room_id: newRoom.id, user_id: profile.id, role: 'admin' });
      
      if (adminError) throw adminError;

      // Add other participants
      if (selectedUsersForGroup.length > 0) {
        const participants = selectedUsersForGroup.map(userId => ({ 
          room_id: newRoom.id, 
          user_id: userId, 
          role: 'member' 
        }));

        const { error: partError } = await supabase.from('chat_participants').insert(participants);
        if (partError) throw partError;
      }

      setIsNewChatOpen(false);
      setGroupName('');
      setSelectedUsersForGroup([]);
      setIsCreatingGroup(false);
      fetchRooms();
      navigate(`/chat/${newRoom.id}`);
      toast.success('Group created successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreatingRoom(false);
    }
  };

  const togglePinMessage = async (msg: Message) => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          is_pinned: !msg.is_pinned,
          pinned_at: !msg.is_pinned ? new Date().toISOString() : null,
          pinned_by: !msg.is_pinned ? profile.id : null
        })
        .eq('id', msg.id);
      
      if (error) throw error;
      toast.success(msg.is_pinned ? 'Message unpinned' : 'Message pinned');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getOtherParticipant = (room: RoomWithParticipants) => {
    if (room.is_group) return null;
    return room.participants?.find(p => p.user.id !== profile?.id)?.user || null;
  };

  const getRoomName = (room: RoomWithParticipants) => {
    if (room.name) return room.name;
    const other = getOtherParticipant(room);
    return other ? other.username : 'Private Chat';
  };

  // Heartbeat to update last_seen_at
  useEffect(() => {
    if (!profile) return;

    const updateLastSeen = async () => {
      await supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', profile.id);
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [profile]);

  // Mark messages as read when room is selected
  useEffect(() => {
    if (!profile || !selectedRoom || messages.length === 0) return;

    const markAsRead = async () => {
      const unreadMessages = messages.filter(m => m.sender_id !== profile.id && !m.is_read);
      if (unreadMessages.length === 0) return;

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadMessages.map(m => m.id));
      
      if (error) console.error('Error marking as read:', error.message);
    };

    markAsRead();
  }, [selectedRoom, messages, profile]);

  const getRoomImage = (room: RoomWithParticipants) => {
    if (room.image_url) return room.image_url;
    const other = getOtherParticipant(room);
    return other ? other.avatar_url : '';
  };

  if (!profile) return null;

  // Subscribe to user status updates
  useEffect(() => {
    const channel = supabase
      .channel('user-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
      }, (payload) => {
        // Update rooms if a participant's status changed
        setRooms(prev => prev.map(room => {
          const updatedParticipants = room.participants?.map(p => 
            p.user.id === payload.new.id ? { ...p, user: { ...p.user, ...payload.new } } : p
          );
          return { ...room, participants: updatedParticipants };
        }));
        
        // Update selected room if its participant changed
        if (selectedRoom) {
          const isParticipant = selectedRoom.participants?.some(p => p.user.id === payload.new.id);
          if (isParticipant) {
            setSelectedRoom(prev => {
              if (!prev) return null;
              const updatedParticipants = prev.participants?.map(p => 
                p.user.id === payload.new.id ? { ...p, user: { ...p.user, ...payload.new } } : p
              );
              return { ...prev, participants: updatedParticipants };
            });
          }
        }

        // Update found users in search
        setFoundUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom]);

  const isUserOnline = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return false;
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    return (now.getTime() - lastSeen.getTime()) < 60000; // Online if seen within last minute
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);

  return (
    <div className="container mx-auto px-0 md:px-4 py-0 md:py-8 h-screen md:h-[calc(100vh-8rem)]">
      <div className="flex flex-col md:flex-row h-full bg-background md:rounded-xl md:shadow-2xl overflow-hidden border">
        {/* Sidebar */}
        <div className={`w-full md:w-[350px] lg:w-[400px] flex flex-col border-r bg-background ${selectedRoom ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger render={<Button size="icon" variant="ghost" className="rounded-full" />}>
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
                  <DialogHeader className="p-4 bg-primary text-white">
                    <DialogTitle className="text-xl">
                      {isCreatingGroup ? 'Nouveau Groupe' : 'Nouveau Chat'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="p-4 space-y-4">
                    {isCreatingGroup ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                            <Camera className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <Input 
                            placeholder="Sujet du Groupe" 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="border-b border-t-0 border-x-0 rounded-none focus-visible:ring-0 px-0 text-lg"
                          />
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Ajouter des participants ({selectedUsersForGroup.length})
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Rechercher des utilisateurs..." 
                          className="pl-10 rounded-full bg-muted/50 border-none"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                        />
                      </div>
                    )}

                    <ScrollArea className="h-[300px] -mx-4 px-4">
                      {isCreatingGroup ? (
                        <div className="space-y-1">
                          {foundUsers.length > 0 ? foundUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={() => {
                              setSelectedUsersForGroup(prev => 
                                prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                              );
                            }}>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.avatar_url || ''} />
                                  <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{user.username}</span>
                              </div>
                              <Checkbox checked={selectedUsersForGroup.includes(user.id)} />
                            </div>
                          )) : (
                            <p className="text-center py-8 text-muted-foreground">Recherchez des utilisateurs à ajouter</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start gap-4 h-14 px-2"
                            onClick={() => {
                              setIsCreatingGroup(true);
                              setFoundUsers([]);
                              setUserSearch('');
                            }}
                          >
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                              <Users className="w-5 h-5" />
                            </div>
                            <span className="font-bold">Nouveau Groupe</span>
                          </Button>
                          
                          <div className="py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">
                            {userSearch ? 'Résultats de recherche' : 'Utilisateurs en ligne'}
                          </div>

                          {searchingUsers ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          ) : foundUsers.length > 0 ? (
                            foundUsers.map(user => (
                              <Button 
                                key={user.id} 
                                variant="ghost" 
                                className="w-full justify-start gap-4 h-14 px-2"
                                onClick={() => startPrivateChat(user)}
                              >
                                <div className="relative">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.avatar_url || ''} />
                                    <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  {isUserOnline(user.last_seen_at) && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-chart-3 border-2 border-white rounded-full"></div>
                                  )}
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="font-bold text-sm">{user.username}</span>
                                  {isUserOnline(user.last_seen_at) ? (
                                    <span className="text-xs text-chart-3 font-medium">En ligne</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Hors ligne</span>
                                  )}
                                </div>
                              </Button>
                            ))
                          ) : (
                            <p className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</p>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <DialogFooter className="p-4 bg-muted/30">
                    {isCreatingGroup ? (
                      <div className="flex justify-between w-full items-center">
                        <Button variant="ghost" onClick={() => setIsCreatingGroup(false)}>Retour</Button>
                        <Button 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8"
                          disabled={!groupName.trim() || selectedUsersForGroup.length === 0 || creatingRoom}
                          onClick={createGroupChat}
                        >
                          {creatingRoom ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer le Groupe'}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" className="w-full" onClick={() => setIsNewChatOpen(false)}>Annuler</Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button size="icon" variant="ghost" className="rounded-full">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher ou démarrer un nouveau chat" className="pl-10 bg-muted/50 border-none rounded-full h-10 focus-visible:ring-emerald-500" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-muted/50">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : rooms.length > 0 ? (
                rooms.map((room) => {
                  const other = getOtherParticipant(room);
                  const isSelected = selectedRoom?.id === room.id;
                  return (
                    <div
                      key={room.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
                      onClick={() => {
                        setSelectedRoom(room);
                        navigate(`/chat/${room.id}`);
                      }}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border">
                          <AvatarImage src={getRoomImage(room) || ''} />
                          <AvatarFallback>
                            {room.is_group ? <Users className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                          </AvatarFallback>
                        </Avatar>
                        {!room.is_group && isUserOnline(other?.last_seen_at) && (
                          <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-chart-3 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-sm truncate">
                            {getRoomName(room)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {room.last_message_at ? format(new Date(room.last_message_at), 'HH:mm') : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCheck className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs text-muted-foreground truncate">
                            {room.is_group ? 'Chat de Groupe' : `@${other?.username || 'utilisateur'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Pas encore de chats. Cliquez sur le bouton + pour commencer une conversation !</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col bg-[#efeae2] relative ${!selectedRoom ? 'hidden md:flex' : 'flex'}`}>
          {/* WhatsApp Doodle Background */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} />

          {selectedRoom ? (
            <>
              {/* Header */}
              <div className="p-3 bg-muted/90 backdrop-blur-sm border-b flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => {
                    setSelectedRoom(null);
                    navigate('/chat');
                  }}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={getRoomImage(selectedRoom) || ''} />
                    <AvatarFallback>
                      {selectedRoom.is_group ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-tight">{getRoomName(selectedRoom)}</span>
                    {!selectedRoom.is_group && (
                      <span className="text-[10px] text-muted-foreground">
                        {isUserOnline(getOtherParticipant(selectedRoom)?.last_seen_at) ? (
                          <span className="text-chart-3 font-medium">en ligne</span>
                        ) : (
                          <span>hors ligne</span>
                        )}
                      </span>
                    )}
                    {selectedRoom.is_group && (
                      <span className="text-[10px] text-muted-foreground">
                        {selectedRoom.participants?.length || 0} participants
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="rounded-full hidden sm:flex">
                    <Video className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-full hidden sm:flex">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <div className="w-px h-6 bg-muted-foreground/20 mx-1 hidden sm:block" />
                  <Button size="icon" variant="ghost" className="rounded-full">
                    <Search className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-full">
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Pinned Messages Bar */}
              {pinnedMessages.length > 0 && (
                <div className="bg-white/90 backdrop-blur-sm p-2 px-4 border-b flex items-center justify-between z-10 animate-in slide-in-from-top duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Pin className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Message Épinglé</span>
                      <p className="text-xs truncate text-muted-foreground">
                        {pinnedMessages[pinnedMessages.length - 1].content}
                      </p>
                    </div>
                  </div>
                  <Button size="icon-xs" variant="ghost" onClick={() => togglePinMessage(pinnedMessages[pinnedMessages.length - 1])}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4 md:p-6 relative z-0">
                <div className="space-y-2 max-w-4xl mx-auto">
                  <div className="flex justify-center mb-4">
                    <span className="bg-white/80 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg shadow-sm text-muted-foreground">
                      Aujourd'hui
                    </span>
                  </div>

                  {messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === profile.id;
                    const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                    
                    return (
                      <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`relative flex flex-col max-w-[85%] sm:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Reply Context */}
                          {msg.reply_to && (
                            <div className={`mb-[-8px] px-3 pt-2 pb-4 rounded-t-lg text-xs border-l-4 border-primary bg-black/5 flex flex-col gap-0.5 w-full ${isOwn ? 'mr-1' : 'ml-1'}`}>
                              <span className="font-bold text-primary">
                                {msg.reply_to.sender_id === profile.id ? 'Vous' : 'Utilisateur'}
                              </span>
                              <p className="truncate opacity-70 italic">{msg.reply_to.content}</p>
                            </div>
                          )}

                          <div className={`relative px-3 py-1.5 rounded-xl shadow-sm text-sm group ${
                            isOwn 
                              ? 'bg-primary/20 text-foreground rounded-tr-none' 
                              : 'bg-white text-foreground rounded-tl-none'
                          }`}>
                            {/* Message Tail */}
                            <div className={`absolute top-0 w-3 h-3 ${
                              isOwn 
                                ? 'right-[-8px] bg-primary/20' 
                                : 'left-[-8px] bg-white'
                            }`} style={{ clipPath: isOwn ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(0 0, 100% 100%, 100% 0)' }} />

                            {/* Group Sender Name */}
                            {selectedRoom.is_group && !isOwn && (
                              <p className="text-[10px] font-bold text-primary mb-0.5">
                                {msg.sender?.username || 'User'}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap break-words leading-relaxed pr-12">
                              {msg.content}
                            </p>

                            {/* Message Meta (Time + Status) */}
                            <div className="absolute bottom-1 right-2 flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground/70">
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </span>
                              {isOwn && (
                                msg.id.toString().startsWith('temp-') ? (
                                  <Check className="w-3 h-3 text-muted-foreground/50" />
                                ) : msg.is_read ? (
                                  <CheckCheck className="w-3 h-3 text-accent" />
                                ) : (
                                  <CheckCheck className="w-3 h-3 text-muted-foreground/50" />
                                )
                              )}
                            </div>

                            {/* Message Actions (Hover) */}
                            <div className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${isOwn ? 'bg-[#dcf8c6]/80' : 'bg-white/80'} rounded-md p-0.5`}>
                              <Button size="icon-xs" variant="ghost" onClick={() => setReplyingTo(msg)}>
                                <CornerUpRight className="w-3 h-3" />
                              </Button>
                              <Button size="icon-xs" variant="ghost" onClick={() => togglePinMessage(msg)}>
                                <Pin className={`w-3 h-3 ${msg.is_pinned ? 'fill-emerald-600 text-emerald-600' : ''}`} />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Pinned Indicator */}
                          {msg.is_pinned && (
                            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-white/50 rounded-full border border-emerald-500/20">
                              <Pin className="w-2 h-2 text-emerald-600" />
                              <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Épinglé</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} className="h-4" />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-2 md:p-4 bg-muted/50 backdrop-blur-sm border-t z-10">
                {/* Reply Preview */}
                {replyingTo && (
                  <div className="mb-2 p-3 bg-white/80 rounded-lg border-l-4 border-emerald-500 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-xs font-bold text-emerald-600">Répondre à {replyingTo.sender_id === profile.id ? 'vous-même' : 'utilisateur'}</span>
                      <p className="text-xs truncate text-muted-foreground italic">{replyingTo.content}</p>
                    </div>
                    <Button size="icon-xs" variant="ghost" onClick={() => setReplyingTo(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground">
                      <Smile className="w-6 h-6" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="rounded-full text-muted-foreground">
                      <Paperclip className="w-6 h-6" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Écrivez un message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-white border-none rounded-full h-11 focus-visible:ring-0 shadow-sm"
                  />
                  {newMessage.trim() ? (
                    <Button 
                      type="submit" 
                      size="icon" 
                      disabled={sending}
                      className="rounded-full h-11 w-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shrink-0"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      size="icon" 
                      className="rounded-full h-11 w-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shrink-0"
                    >
                      <Mic className="w-5 h-5" />
                    </Button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center z-10">
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-inner">
                <MessageSquare className="w-12 h-12 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">ESCIC Chat</h3>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Envoyez et recevez des messages sans garder votre téléphone en ligne.
                Utilisez ESCIC Chat sur jusqu'à 4 appareils liés et 1 téléphone en même temps.
              </p>
              <div className="mt-12 flex items-center gap-2 text-muted-foreground text-xs">
                <Users className="w-4 h-4" />
                Chiffré de bout en bout
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
