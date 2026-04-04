import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Post, UserProfile } from '@/src/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface UserStatus {
  user: UserProfile;
  statuses: Post[];
}

function SegmentedCircle({ count, size = 64, strokeWidth = 2, color = "#10b981" }: { count: number, size?: number, strokeWidth?: number, color?: string }) {
  if (count <= 1) {
    return (
      <div 
        className="absolute inset-0 rounded-full border-2 border-dashed" 
        style={{ borderColor: color, margin: '-2px' }} 
      />
    );
  }

  const radius = (size / 2) + 1;
  const center = radius;
  const circumference = 2 * Math.PI * radius;
  const gap = 4; // pixels between segments
  const segmentLength = (circumference - (count * gap)) / count;

  return (
    <svg 
      width={size + 4} 
      height={size + 4} 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 pointer-events-none"
      style={{ width: size + 4, height: size + 4 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <circle
          key={i}
          cx={center + 1}
          cy={center + 1}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
          strokeDashoffset={-i * (segmentLength + gap)}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function StatusTray({ refreshTrigger }: { refreshTrigger?: number }) {
  const { profile } = useAuth();
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  useEffect(() => {
    fetchStatuses();
  }, [refreshTrigger]);

  const fetchStatuses = async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('posts')
        .select('*, author:users(*)')
        .eq('post_type', 'status')
        .gt('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by user
      const grouped: { [key: string]: UserStatus } = {};
      data?.forEach((post: any) => {
        if (!post.author) return;
        if (!grouped[post.author_id]) {
          grouped[post.author_id] = {
            user: post.author,
            statuses: []
          };
        }
        grouped[post.author_id].statuses.push(post);
      });

      setUserStatuses(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const openStatus = (index: number) => {
    setSelectedUserIndex(index);
    setCurrentStatusIndex(0);
  };

  const closeStatus = () => {
    setSelectedUserIndex(null);
    setCurrentStatusIndex(0);
  };

  const nextStatus = () => {
    if (selectedUserIndex === null) return;
    
    const currentUserStatuses = userStatuses[selectedUserIndex].statuses;
    if (currentStatusIndex < currentUserStatuses.length - 1) {
      setCurrentStatusIndex(prev => prev + 1);
    } else if (selectedUserIndex < userStatuses.length - 1) {
      setSelectedUserIndex(prev => prev! + 1);
      setCurrentStatusIndex(0);
    } else {
      closeStatus();
    }
  };

  const prevStatus = () => {
    if (selectedUserIndex === null) return;
    
    if (currentStatusIndex > 0) {
      setCurrentStatusIndex(prev => prev - 1);
    } else if (selectedUserIndex > 0) {
      setSelectedUserIndex(prev => prev! - 1);
      const prevUserStatuses = userStatuses[selectedUserIndex - 1].statuses;
      setCurrentStatusIndex(prevUserStatuses.length - 1);
    }
  };

  // Auto-advance and Escape listener
  useEffect(() => {
    let timer: any;
    if (selectedUserIndex !== null) {
      timer = setTimeout(nextStatus, 5000);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStatus();
      if (e.key === 'ArrowRight') nextStatus();
      if (e.key === 'ArrowLeft') prevStatus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedUserIndex, currentStatusIndex]);

  const getStatusBackground = (status: Post) => {
    if (status.media_url) return 'bg-zinc-900';
    if (status.background_color) return status.background_color;
    // Generate a stable background color based on post ID
    const colors = [
      'bg-gradient-to-br from-pink-500 to-rose-500',
      'bg-gradient-to-br from-purple-600 to-blue-500',
      'bg-gradient-to-br from-emerald-500 to-teal-600',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-indigo-500 to-purple-600',
    ];
    const index = status.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  if (loading) return null;
  if (userStatuses.length === 0 && !profile) return null;

  return (
    <div className="mb-8 space-y-3">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">Recent Updates</h3>
      <div className="overflow-x-auto no-scrollbar py-2">
        <div className="flex gap-4 items-center">
        {/* Your Status (Add button style) */}
        {profile && (
          <div 
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
            onClick={() => {
              const myStatusIdx = userStatuses.findIndex(us => us.user.id === profile.id);
              if (myStatusIdx !== -1) {
                openStatus(myStatusIdx);
              } else {
                // Scroll to CreatePost or focus it?
                document.querySelector('textarea')?.focus();
              }
            }}
          >
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-background">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback>{profile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {userStatuses.some(us => us.user.id === profile.id) ? (
                <SegmentedCircle 
                  count={userStatuses.find(us => us.user.id === profile.id)?.statuses.length || 0} 
                  color="#10b981"
                />
              ) : (
                <div className="absolute bottom-0 right-0 bg-emerald-600 text-white rounded-full p-0.5 border-2 border-background">
                  <Plus className="w-3 h-3" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-medium">Your Status</span>
          </div>
        )}

        {/* Other Statuses */}
        {userStatuses
          .filter(us => us.user.id !== profile?.id)
          .map((us) => {
            const originalIdx = userStatuses.findIndex(s => s.user.id === us.user.id);
            return (
              <div 
                key={us.user.id} 
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                onClick={() => openStatus(originalIdx)}
              >
                <div className="relative group-hover:scale-105 transition-transform">
                  <Avatar className="h-16 w-16 border-2 border-background">
                    <AvatarImage src={us.user.avatar_url || ''} />
                    <AvatarFallback>{us.user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <SegmentedCircle count={us.statuses.length} color="#10b981" />
                </div>
                <span className="text-[10px] font-medium truncate w-16 text-center">
                  {us.user.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Viewer Modal */}
      <AnimatePresence>
        {selectedUserIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <div className={`relative w-full max-w-md h-full md:h-[90vh] md:rounded-2xl overflow-hidden flex flex-col ${getStatusBackground(userStatuses[selectedUserIndex].statuses[currentStatusIndex])}`}>
              {/* Progress Bars */}
              <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
                {userStatuses[selectedUserIndex].statuses.map((_, i) => (
                  <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ 
                        width: i < currentStatusIndex ? '100%' : i === currentStatusIndex ? '100%' : '0%' 
                      }}
                      transition={{ 
                        duration: i === currentStatusIndex ? 5 : 0,
                        ease: "linear"
                      }}
                      className="h-full bg-white"
                    />
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="absolute top-8 left-4 right-4 z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-white/20">
                    <AvatarImage src={userStatuses[selectedUserIndex].user.avatar_url || ''} />
                    <AvatarFallback>{userStatuses[selectedUserIndex].user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-white">
                    <p className="font-bold text-sm">@{userStatuses[selectedUserIndex].user.username}</p>
                    <p className="text-[10px] opacity-70">
                      {formatDistanceToNow(new Date(userStatuses[selectedUserIndex].statuses[currentStatusIndex].created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <button onClick={closeStatus} className="text-white hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center p-8 relative">
                <div className="text-center w-full">
                  <p className={`text-2xl md:text-3xl text-white font-medium leading-tight whitespace-pre-wrap ${userStatuses[selectedUserIndex].statuses[currentStatusIndex].font_family || ''}`}>
                    {userStatuses[selectedUserIndex].statuses[currentStatusIndex].content}
                  </p>
                  {userStatuses[selectedUserIndex].statuses[currentStatusIndex].media_url && (
                    <img 
                      src={userStatuses[selectedUserIndex].statuses[currentStatusIndex].media_url!} 
                      alt="Status media"
                      className="mt-6 rounded-xl max-h-[50vh] object-contain mx-auto shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {/* Navigation Areas (Invisible overlay) */}
                <div className="absolute inset-0 flex">
                  <div className="w-1/3 h-full cursor-pointer" onClick={prevStatus} />
                  <div className="w-2/3 h-full cursor-pointer" onClick={nextStatus} />
                </div>
              </div>

              {/* Footer Controls */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-12 z-20 md:hidden">
                <button onClick={prevStatus} className="text-white/50 hover:text-white">
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button onClick={nextStatus} className="text-white/50 hover:text-white">
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
