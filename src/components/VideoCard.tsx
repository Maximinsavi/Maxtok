import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Music2, Volume2, VolumeX, Play, Pause, Edit3, Trash2, Save, X, MoreHorizontal, Download } from 'lucide-react';
import { Video, UserProfile } from '../types';
import { User } from 'firebase/auth';
import { listenToLike, toggleLikeVideo, listenToFollow, toggleFollowUser, getUserProfile, getVideoFromLocalDB, getVideoChunks, listenToUserProfile, updateVideo, deleteVideo } from '../dbUtils';
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
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Sync state for updated creator profile and edit/delete operations
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(video.description);
  const [editCategory, setEditCategory] = useState(video.category);
  const [editSongName, setEditSongName] = useState(video.songName);
  const [editCropRatio, setEditCropRatio] = useState<'9:16' | '16:9' | '1:1' | 'none'>(video.cropRatio || 'none');
  const [editZoomScale, setEditZoomScale] = useState<number>(video.zoomScale || 1);
  const [editTranslateY, setEditTranslateY] = useState<number>(video.translateY || 0);
  const [editVisualFilter, setEditVisualFilter] = useState<'none' | 'grayscale' | 'sepia' | 'contrast' | 'invert' | 'blur'>(video.visualFilter || 'none');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  const handleDownloadVideo = async () => {
    try {
      const videoSrc = resolvedUrl || video.videoUrl;
      if (!videoSrc) {
        alert("L'URL de la vidéo n'est pas encore prête.");
        return;
      }
      
      if (videoSrc.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = videoSrc;
        link.download = `video-${video.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      if (videoSrc.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = videoSrc;
        link.download = `video-${video.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const response = await fetch(videoSrc);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading video:", err);
      const videoSrc = resolvedUrl || video.videoUrl;
      window.open(videoSrc, '_blank');
    }
  };

  const displayAvatar = creatorProfile?.photoURL || video.creatorAvatar;
  const displayName = creatorProfile?.displayName || video.creatorName;

  // Resolve Video URL (handles IndexedDB local store, Firestore chunks, and fallback)
  useEffect(() => {
    let active = true;
    let blobUrl = '';

    if (video.videoUrl.startsWith('chunked://')) {
      const videoId = video.videoUrl.substring(10);
      setIsLoadingChunks(true);
      getVideoChunks(videoId, video.mimeType || 'video/mp4')
        .then((blob) => {
          if (blob && active) {
            blobUrl = URL.createObjectURL(blob);
            setResolvedUrl(blobUrl);
          }
        })
        .catch((err) => {
          console.error("Error loading chunked video from Firestore:", err);
          if (active) {
            setResolvedUrl('https://assets.mixkit.co/videos/preview/mixkit-audio-wave-of-a-track-on-black-background-42352-large.mp4');
          }
        })
        .finally(() => {
          if (active) setIsLoadingChunks(false);
        });
    } else if (video.videoUrl.startsWith('idb://')) {
      const localId = video.videoUrl.substring(6);
      getVideoFromLocalDB(localId).then((blob) => {
        if (blob && active) {
          blobUrl = URL.createObjectURL(blob);
          setResolvedUrl(blobUrl);
        } else if (active) {
          // Fallback to Abstract Soundwave template video with audio
          setResolvedUrl('https://assets.mixkit.co/videos/preview/mixkit-audio-wave-of-a-track-on-black-background-42352-large.mp4');
        }
      }).catch((err) => {
        console.error("Error loading IndexedDB video:", err);
        if (active) {
          setResolvedUrl('https://assets.mixkit.co/videos/preview/mixkit-audio-wave-of-a-track-on-black-background-42352-large.mp4');
        }
      });
    } else {
      setResolvedUrl(video.videoUrl);
    }

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [video.videoUrl, video.id, video.mimeType]);

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

  // Real-time listener for creator profile updates (keeps profile pictures & display names updated live on all publications!)
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (video.creatorId) {
      unsubscribe = listenToUserProfile(video.creatorId, (profile) => {
        if (profile) {
          setCreatorProfile(profile);
        }
      });
    }
    return () => unsubscribe();
  }, [video.creatorId]);

  // Reset edit fields when the video prop changes
  useEffect(() => {
    setEditDescription(video.description);
    setEditCategory(video.category);
    setEditSongName(video.songName);
    setEditCropRatio(video.cropRatio || 'none');
    setEditZoomScale(video.zoomScale || 1);
    setEditTranslateY(video.translateY || 0);
    setEditVisualFilter(video.visualFilter || 'none');
    setIsEditing(false);
  }, [video]);

  const handleSaveEdit = async () => {
    if (!editDescription.trim()) return;
    setIsSaving(true);
    try {
      await updateVideo(video.id, {
        description: editDescription.trim(),
        category: editCategory,
        songName: editSongName.trim() || 'Son original',
        cropRatio: editCropRatio,
        zoomScale: editZoomScale,
        translateY: editTranslateY,
        visualFilter: editVisualFilter
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Error editing video:", err);
      alert("Une erreur s'est produite lors de la modification. Veuillez réessayer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette vidéo de manière permanente ?")) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteVideo(video.id);
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Une erreur s'est produite lors de la suppression. Veuillez réessayer.");
      setIsDeleting(false);
    }
  };

  const lastClickTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

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

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTimeRef.current;

    if (timeDiff < 300) {
      // Double tap detected!
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      
      // Show heart animation immediately for responsive UI feedback
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 800);

      if (!currentUser) {
        onRequireAuth();
        return;
      }

      // If not liked already, toggle like to liked
      if (!isLiked) {
        try {
          await toggleLikeVideo(video, currentUser.uid, false);
        } catch (err) {
          console.error("Error liking video via double-tap:", err);
        }
      }
    } else {
      // Single tap
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      clickTimeoutRef.current = setTimeout(() => {
        handlePlayPause();
        clickTimeoutRef.current = null;
      }, 300);
    }
    lastClickTimeRef.current = currentTime;
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
    
    const uniqueUrl = `${window.location.origin}${window.location.pathname}?video=${video.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Vidéo de ${video.creatorName}`,
        text: video.description,
        url: uniqueUrl,
      }).catch(() => {
        navigator.clipboard.writeText(uniqueUrl);
        alert("Lien unique de cette vidéo copié dans le presse-papiers !");
      });
    } else {
      navigator.clipboard.writeText(uniqueUrl);
      alert("Lien unique de cette vidéo copié dans le presse-papiers !");
    }
  };

  const currentCrop = isEditing ? editCropRatio : (video.cropRatio || 'none');
  const currentZoom = isEditing ? editZoomScale : (video.zoomScale || 1);
  const currentTranslateY = isEditing ? editTranslateY : (video.translateY || 0);
  const currentFilter = isEditing ? editVisualFilter : (video.visualFilter || 'none');

  const filterStyles: Record<string, string> = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(80%)',
    contrast: 'contrast(140%) saturate(120%)',
    invert: 'invert(100%)',
    blur: 'blur(4px)'
  };

  const videoStyle: React.CSSProperties = {
    transform: `scale(${currentZoom}) translateY(${currentTranslateY}px)`,
    filter: filterStyles[currentFilter] || '',
    objectFit: currentCrop === 'none' ? 'cover' : 'contain',
    transition: isEditing ? 'none' : 'transform 0.3s ease, filter 0.3s ease'
  };

  const getContainerClassName = () => {
    if (currentCrop === '1:1') return 'aspect-square w-full max-w-full max-h-[100%] overflow-hidden relative flex items-center justify-center bg-zinc-950 transition-all duration-300';
    if (currentCrop === '16:9') return 'aspect-video w-full max-w-full max-h-[100%] overflow-hidden relative flex items-center justify-center bg-zinc-950 transition-all duration-300';
    if (currentCrop === '9:16') return 'aspect-[9/16] h-full max-w-full overflow-hidden relative flex items-center justify-center bg-zinc-950 transition-all duration-300';
    return 'w-full h-full relative overflow-hidden flex items-center justify-center transition-all duration-300';
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full snap-start bg-black flex flex-col items-center justify-center overflow-hidden"
      id={`video-card-${video.id}`}
    >
      {/* Crop container wrapper */}
      <div className={getContainerClassName()}>
        {/* Video element */}
        <video
          ref={videoRef}
          src={resolvedUrl}
          loop
          playsInline
          webkit-playsinline="true"
          referrerPolicy="no-referrer"
          onClick={handleVideoClick}
          onLoadedData={() => setVideoLoaded(true)}
          className="w-full h-full cursor-pointer"
          style={videoStyle}
          id={`video-player-${video.id}`}
        />
      </div>

      {/* Loading Spinner */}
      {(!videoLoaded || isLoadingChunks) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 z-10 gap-2">
          <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
          {isLoadingChunks && (
            <span className="text-[10px] text-rose-400 font-bold animate-pulse uppercase tracking-widest mt-1">
              Chargement Cloud...
            </span>
          )}
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
              src={displayAvatar} 
              alt={displayName} 
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
            className={`p-2.5 rounded-full backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all ${
              isLiked ? 'bg-rose-500/20 text-rose-500' : 'bg-black/40 text-white'
            }`}
            id={`like-btn-${video.id}`}
          >
            <Heart size={19} className={isLiked ? 'fill-rose-500' : ''} />
          </button>
          <span className="text-white text-[11px] font-semibold mt-1 drop-shadow-md">
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
            className="p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all"
            id={`comments-toggle-btn-${video.id}`}
          >
            <MessageCircle size={19} />
          </button>
          <span className="text-white text-[11px] font-semibold mt-1 drop-shadow-md">
            {video.commentsCount}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={handleShareClick}
            className="p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all"
            id={`share-btn-${video.id}`}
          >
            <Share2 size={19} />
          </button>
          <span className="text-white text-[11px] font-semibold mt-1 drop-shadow-md">
            {video.sharesCount}
          </span>
        </div>

        {/* Edit/Delete Buttons for the Creator */}
        {currentUser?.uid === video.creatorId && (
          <>
            {/* Edit Button */}
            <div className="flex flex-col items-center">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-2.5 bg-rose-500 hover:bg-rose-600 rounded-full text-white backdrop-blur-md border border-rose-400/20 shadow-lg active:scale-90 transition-all"
                id={`edit-video-btn-${video.id}`}
                title="Modifier les détails"
              >
                <Edit3 size={19} />
              </button>
              <span className="text-white text-[9px] font-bold mt-1 drop-shadow-md uppercase tracking-wider">
                Modifier
              </span>
            </div>

            {/* Delete Button */}
            <div className="flex flex-col items-center">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteVideo();
                }}
                className="p-2.5 bg-zinc-900/80 hover:bg-red-600/90 rounded-full text-zinc-300 hover:text-white backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all"
                id={`delete-video-btn-${video.id}`}
                title="Supprimer la vidéo"
              >
                <Trash2 size={19} />
              </button>
              <span className="text-zinc-400 text-[9px] font-bold mt-1 drop-shadow-md uppercase tracking-wider">
                Supprimer
              </span>
            </div>
          </>
        )}

        {/* 3-dots option dropdown */}
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowOptionsDropdown(!showOptionsDropdown);
            }}
            className="p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md border border-white/5 shadow-lg active:scale-90 transition-all mt-1"
            id={`options-btn-${video.id}`}
            title="Plus d'options"
          >
            <MoreHorizontal size={19} />
          </button>
          
          <AnimatePresence>
            {showOptionsDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionsDropdown(false);
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -10 }}
                  className="absolute right-0 bottom-12 w-40 bg-zinc-950/95 border border-zinc-800/80 rounded-xl p-1.5 shadow-2xl z-50 backdrop-blur-md flex flex-col text-left"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOptionsDropdown(false);
                      handleDownloadVideo();
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                  >
                    <Download size={14} className="text-rose-400" />
                    <span>Télécharger</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOptionsDropdown(false);
                      const shareUrl = `${window.location.origin}?video=${video.id}`;
                      navigator.clipboard.writeText(shareUrl)
                        .then(() => alert("Lien de la vidéo copié !"))
                        .catch(() => alert("Impossible de copier le lien."));
                    }}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                  >
                    <Share2 size={14} className="text-rose-400" />
                    <span>Copier le lien</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
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
            @{displayName}
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

      {/* Edit Overlay Form */}
      <AnimatePresence>
        {isEditing && (
          <div className="absolute inset-0 z-35 bg-black/95 backdrop-blur-md flex items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left space-y-4 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsEditing(false)}
                className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={16} />
              </button>

              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Edit3 size={16} className="text-rose-500" />
                  Modifier la publication
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">Mettez à jour les détails de votre vidéo</p>
              </div>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Description / Légende</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-zinc-950 text-xs p-3 rounded-xl text-white border border-zinc-800 focus:border-rose-500 outline-none resize-none h-16"
                    placeholder="Écrivez une description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Catégorie</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-zinc-950 text-xs p-2.5 rounded-xl text-white border border-zinc-800 focus:border-rose-500 outline-none"
                    >
                      <option value="comedy">Humour 🎭</option>
                      <option value="tech">Tech 💻</option>
                      <option value="music">Musique 🎧</option>
                      <option value="sports">Sports 🛹</option>
                      <option value="food">Food 🍔</option>
                      <option value="nature">Nature 🌲</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Musique / Son</label>
                    <input
                      type="text"
                      value={editSongName}
                      onChange={(e) => setEditSongName(e.target.value)}
                      className="w-full bg-zinc-950 text-xs p-2.5 rounded-xl text-white border border-zinc-800 focus:border-rose-500 outline-none"
                      placeholder="Ex: Son original - @nom"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800/60 pt-3">
                  <span className="block text-[10px] font-extrabold text-rose-400 uppercase tracking-widest mb-2.5">Outils d'Édition Vidéo 🎬</span>
                  
                  <div className="space-y-3">
                    {/* Crop aspect ratio buttons */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Format de Recadrage (Crop)</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'none', label: 'Original' },
                          { id: '9:16', label: '9:16' },
                          { id: '1:1', label: '1:1' },
                          { id: '16:9', label: '16:9' }
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setEditCropRatio(item.id as any)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                              editCropRatio === item.id
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scale Slider */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        <span>Zoom</span>
                        <span className="text-rose-400">{editZoomScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.05"
                        value={editZoomScale}
                        onChange={(e) => setEditZoomScale(parseFloat(e.target.value))}
                        className="w-full accent-rose-500 bg-zinc-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Vertical offset displacement */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        <span>Déplacement vertical</span>
                        <span className="text-rose-400">{editTranslateY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        step="5"
                        value={editTranslateY}
                        onChange={(e) => setEditTranslateY(parseInt(e.target.value))}
                        className="w-full accent-rose-500 bg-zinc-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Visual Filters selection */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Filtres Créatifs</label>
                      <select
                        value={editVisualFilter}
                        onChange={(e) => setEditVisualFilter(e.target.value as any)}
                        className="w-full bg-zinc-950 text-xs p-2.5 rounded-xl text-white border border-zinc-800 focus:border-rose-500 outline-none"
                      >
                        <option value="none">Aucun 🌈</option>
                        <option value="grayscale">Noir & Blanc 🎞️</option>
                        <option value="sepia">Sépia Rétro 📜</option>
                        <option value="contrast">Cinéma Élevé 🎬</option>
                        <option value="invert">Négatif 🕶️</option>
                        <option value="blur">Flou Artistique 🌫️</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-bold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editDescription.trim()}
                  className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={14} />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deleting Overlay */}
      <AnimatePresence>
        {isDeleting && (
          <div className="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
            <span className="text-xs text-rose-400 font-bold animate-pulse uppercase tracking-widest mt-2">
              Suppression en cours...
            </span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
