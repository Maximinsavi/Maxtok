import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Music2, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Video, UserProfile } from '../types';
import { User } from 'firebase/auth';
import { listenToLike, toggleLikeVideo, listenToFollow, toggleFollowUser, getUserProfile } from '../dbUtils';
import CommentsDrawer from './CommentsDrawer';

interface VideoCardProps {
  key?: any;
  video: Video;
  currentUser: User | null;
  currentUserProfile: UserProfile | null;
  isActive: boolean; // Is currently in center screen
  isMuted: boolean;
  onToggleMute: () => void;
  onRequireAuth: () => void;
  onSelectCreator: (creatorId: string) => void;
}

export default function VideoCard({
  video,
  currentUser,
  currentUserProfile,
  isActive,
  isMuted,
  onToggleMute,
  onRequireAuth,
  onSelectCreator
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  // Synchronize play/pause state based on isActive prop
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      // Small timeout to allow render and avoid browser autoplay race conditions
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.log("Autoplay was prevented, waiting for user click.", err);
            setIsPlaying(false);
          });
      }
    } else {
      videoEl.pause();
      videoEl.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  // Handle local muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Real-time listener for Likes
  useEffect(() => {
    if (!currentUser) {
      setIsLiked(false);
      return;
    }
    const unsubscribe = listenToLike(video.id, currentUser.uid, (liked) => {
      setIsLiked(liked);
    });
    return () => unsubscribe();
  }, [video.id, currentUser]);

  // Real-time listener for Follow status of video creator
  useEffect(() => {
    if (!currentUser || currentUser.uid === video.creatorId) {
      setIsFollowing(false);
      return;
    }
    const unsubscribe = listenToFollow(currentUser.uid, video.creatorId, (following) => {
      setIsFollowing(following);
    });
    return () => unsubscribe();
  }, [video.creatorId, currentUser]);

  const handlePlayPause = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
      setIsPlaying(false);
      setShowPlayOverlay(true);
      setTimeout(() => setShowPlayOverlay(false), 800);
    } else {
      videoEl.play().then(() => {
        setIsPlaying(true);
        setShowPlayOverlay(true);
        setTimeout(() => setShowPlayOverlay(false), 800);
      });
    }
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    // Call database toggle like
    await toggleLikeVideo(video, currentUser.uid, isLiked);
    
    if (!isLiked) {
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 800);
    }
  };

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!currentUserProfile) return;
    await toggleFollowUser(currentUserProfile, video.creatorId, isFollowing);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Fallback share logic
    if (navigator.share) {
      navigator.share({
        title: `Vidéo de ${video.creatorName}`,
        text: video.description,
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Copy to clipboard fallback
      navigator.clipboard.writeText(window.location.href);
      alert("Lien de l'application copié dans le presse-papiers !");
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full snap-start bg-black flex flex-col items-center justify-center overflow-hidden"
      id={`video-card-${video.id}`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        loop
        playsInline
        webkit-playsinline="true"
        onClick={handlePlayPause}
        onLoadedData={() => setVideoLoaded(true)}
        className="w-full h-full object-cover cursor-pointer"
        id={`video-player-${video.id}`}
      />

      {/* Loading Spinner */}
      {!videoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Play/Pause Overlay Animation */}
      <AnimatePresence>
        {showPlayOverlay && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute p-4 bg-black/50 rounded-full pointer-events-none"
          >
            {isPlaying ? (
              <Play className="text-white fill-white" size={36} />
            ) : (
              <Pause className="text-white fill-white" size={36} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Heart Burst Animation */}
      <AnimatePresence>
        {showHeartAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0, scale: 2 }}
            className="absolute text-rose-500 pointer-events-none drop-shadow-xl z-20"
          >
            <Heart size={100} className="fill-rose-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Muted toggle float button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all border border-white/10"
        id="mute-btn"
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Right Interaction Sidebar */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* Creator Profile Link */}
        <div className="relative mb-2">
          <button 
            onClick={() => onSelectCreator(video.creatorId)}
            className="w-12 h-12 rounded-full border-2 border-white overflow-hidden active:scale-95 transition-transform shrink-0 shadow-lg"
          >
            <img 
              src={video.creatorAvatar} 
              alt={video.creatorName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
          
          {/* Follow Button (+ badge) */}
          {currentUser?.uid !== video.creatorId && (
            <button
              onClick={handleFollowClick}
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full border border-white font-bold text-white shadow-md active:scale-90 transition-all ${
                isFollowing ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-rose-500 hover:bg-rose-600'
              }`}
              id={`follow-creator-btn-${video.creatorId}`}
            >
              <span className="text-xs leading-none">{isFollowing ? '✓' : '+'}</span>
            </button>
          )}
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={handleLikeClick}
            className={`p-3 rounded-full backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all ${
              isLiked ? 'bg-rose-500/20 text-rose-500' : 'bg-black/40 text-white'
            }`}
            id={`like-btn-${video.id}`}
          >
            <Heart size={22} className={isLiked ? 'fill-rose-500' : ''} />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
            {video.likesCount}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all"
            id={`comments-toggle-btn-${video.id}`}
          >
            <MessageCircle size={22} />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
            {video.commentsCount}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={handleShareClick}
            className="p-3 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all"
            id={`share-btn-${video.id}`}
          >
            <Share2 size={22} />
          </button>
          <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
            {video.sharesCount}
          </span>
        </div>

        {/* Rotating Music Disc */}
        <div className="w-10 h-10 mt-2 rounded-full border border-zinc-700 bg-zinc-950 flex items-center justify-center animate-[spin_5s_linear_infinite] overflow-hidden shadow-xl">
          <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </div>
      </div>

      {/* Bottom Information (Description, music track, tags) */}
      <div className="absolute left-4 bottom-6 right-20 text-left z-20 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Creator name */}
          <button 
            onClick={() => onSelectCreator(video.creatorId)}
            className="text-white font-bold text-base hover:underline select-text"
          >
            @{video.creatorName}
          </button>
          
          {/* Category Badge */}
          <span className="ml-2.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-sm">
            {video.category}
          </span>

          {/* Description text */}
          <p className="text-white text-sm mt-1.5 font-normal break-words line-clamp-3 select-text leading-relaxed">
            {video.description}
          </p>

          {/* Music track ticker */}
          <div className="flex items-center gap-1.5 mt-3 text-white/90 text-xs font-medium max-w-xs overflow-hidden">
            <Music2 size={13} className="shrink-0 animate-pulse" />
            <div className="whitespace-nowrap animate-[scroll_12s_linear_infinite]">
              {video.songName}
            </div>
          </div>
        </div>
      </div>

      {/* Custom styled gradient vignetting for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />

      {/* Sliding comments drawer */}
      <AnimatePresence>
        {showComments && (
          <CommentsDrawer
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            video={video}
            currentUser={currentUser}
            onRequireAuth={onRequireAuth}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
