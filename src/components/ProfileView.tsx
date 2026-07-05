import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  Settings, 
  Grid, 
  UserPlus, 
  MessageCircle, 
  Palette, 
  Check, 
  Edit3, 
  Save, 
  Lock,
  ChevronLeft,
  Heart,
  Users,
  Camera,
  Globe,
  Sparkles,
  Info,
  User,
  Link as LinkIcon
} from 'lucide-react';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { 
  getUserProfile, 
  updateUserProfileDetails, 
  listenToFollow, 
  toggleFollowUser, 
  createOrGetChat,
  getVideos,
  getFollowers,
  getFollowing,
  getLikedVideos,
  listenToUserProfile,
  getVideoFromLocalDB
} from '../dbUtils';
import { UserProfile, Video, DarkThemeType, THEMES } from '../types';

interface ProfileViewProps {
  profileId: string; // The ID of the profile we are viewing
  currentUser: FirebaseUser | null;
  currentUserProfile: UserProfile | null;
  selectedThemeId: DarkThemeType;
  onThemeChange: (themeId: DarkThemeType) => void;
  onRequireAuth: () => void;
  onOpenDM: () => void; // Redirect to Inbox DM tab
  onSelectVideo: (videoId: string) => void; // Play the clicked video in feed
  onBackToFeed: () => void; // Go back to video feed
  onProfileUpdate?: (profile: UserProfile) => void; // Callback to keep App state in sync
  onSelectCreator?: (creatorId: string) => void; // Callback to navigate to another profile
}

type TabType = 'publications' | 'liked' | 'following' | 'followers';

const PRESET_AVATARS = [
  { name: 'Neon Studio', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
  { name: 'Classic Portrait', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  { name: 'Urban Active', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
  { name: 'Creative Focus', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { name: 'Modern Elegant', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80' },
  { name: 'Golden Hour', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' },
];

function ProfileVideoThumbnail({ video }: { video: Video }) {
  const [resolvedUrl, setResolvedUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    if (video.videoUrl.startsWith('idb://')) {
      const localId = video.videoUrl.substring(6);
      getVideoFromLocalDB(localId).then((blob) => {
        if (blob && active) {
          objectUrl = URL.createObjectURL(blob);
          setResolvedUrl(objectUrl);
        } else if (active) {
          setResolvedUrl('https://assets.mixkit.co/videos/preview/mixkit-audio-wave-of-a-track-on-black-background-42352-large.mp4');
        }
      });
    } else {
      setResolvedUrl(video.videoUrl);
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [video.videoUrl]);

  return (
    <video 
      src={resolvedUrl} 
      className="w-full h-full object-cover"
      preload="metadata"
      muted
    />
  );
}

export default function ProfileView({
  profileId,
  currentUser,
  currentUserProfile,
  selectedThemeId,
  onThemeChange,
  onRequireAuth,
  onOpenDM,
  onSelectVideo,
  onBackToFeed,
  onProfileUpdate,
  onSelectCreator
}: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tab systems
  const [activeTab, setActiveTab] = useState<TabType>('publications');
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [loadingTabContent, setLoadingTabContent] = useState(false);

  // Custom Edit Profile Section
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');

  const isOwnProfile = currentUser ? currentUser.uid === profileId : false;

  // Initial load with real-time profile updates
  useEffect(() => {
    if (!profileId) return;
    
    setLoading(true);
    let active = true;

    // Listen to profile updates in real-time
    const unsubscribeProfile = listenToUserProfile(profileId, (uProfile) => {
      if (uProfile && active) {
        setProfile(uProfile);
        // Setup initial editing fields if not editing
        setEditDisplayName(uProfile.displayName);
        setEditUsername(uProfile.username);
        setEditPhotoURL(uProfile.photoURL);
        setEditBio(uProfile.bio || '');
      } else if (isOwnProfile && currentUserProfile && active) {
        setProfile(currentUserProfile);
        setEditDisplayName(currentUserProfile.displayName);
        setEditUsername(currentUserProfile.username);
        setEditPhotoURL(currentUserProfile.photoURL);
        setEditBio(currentUserProfile.bio || '');
      }
    });
    
    async function loadVideos() {
      // Load user's videos
      const allVideos = await getVideos();
      if (!active) return;
      const userVids = allVideos.filter(v => v.creatorId === profileId);
      setVideos(userVids);
      setLoading(false);
    }
    
    loadVideos();

    return () => { 
      active = false; 
      unsubscribeProfile();
    };
  }, [profileId, isOwnProfile, currentUserProfile]);

  // Sync tab data on change
  useEffect(() => {
    if (!profileId) return;
    
    let active = true;
    async function loadTabDetails() {
      if (activeTab === 'liked') {
        setLoadingTabContent(true);
        const liked = await getLikedVideos(profileId);
        if (active) {
          setLikedVideos(liked);
          setLoadingTabContent(false);
        }
      } else if (activeTab === 'following') {
        setLoadingTabContent(true);
        const following = await getFollowing(profileId);
        if (active) {
          setFollowingList(following);
          setLoadingTabContent(false);
        }
      } else if (activeTab === 'followers') {
        setLoadingTabContent(true);
        const followers = await getFollowers(profileId);
        if (active) {
          setFollowersList(followers);
          setLoadingTabContent(false);
        }
      }
    }
    
    loadTabDetails();
    return () => { active = false; };
  }, [profileId, activeTab]);

  // Listen to follow state
  useEffect(() => {
    if (!currentUser || isOwnProfile || !profileId) {
      setIsFollowing(false);
      return;
    }
    const unsubscribe = listenToFollow(currentUser.uid, profileId, (following) => {
      setIsFollowing(following);
    });
    return () => unsubscribe();
  }, [currentUser, profileId, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!currentUserProfile) return;
    await toggleFollowUser(currentUserProfile, profileId, isFollowing);
    // Refresh local follower count
    setProfile(prev => prev ? {
      ...prev,
      followersCount: prev.followersCount + (isFollowing ? -1 : 1)
    } : null);
  };

  const handleMessageClick = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await createOrGetChat(currentUser.uid, profileId);
      onOpenDM();
    } catch (err) {
      console.error("Error launching chat:", err);
    }
  };

  const handleApplyDicebearSeed = () => {
    if (!avatarSeed.trim()) return;
    const generatedUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(avatarSeed.trim())}`;
    setEditPhotoURL(generatedUrl);
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          setEditPhotoURL(compressedBase64);
        }
      };
      img.onerror = () => {
        setEditError("Impossible de charger l'image sélectionnée.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setEditError("Erreur lors de la lecture du fichier photo.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    const cleanUsername = editUsername.trim().replace(/\s+/g, '_').toLowerCase();
    if (!cleanUsername) {
      setEditError("Le nom d'utilisateur est obligatoire.");
      return;
    }
    
    if (!editDisplayName.trim()) {
      setEditError("Le nom d'affichage est obligatoire.");
      return;
    }

    setEditError('');
    setIsSavingProfile(true);
    
    try {
      const updatedData = {
        displayName: editDisplayName.trim(),
        username: cleanUsername,
        bio: editBio.trim(),
        photoURL: editPhotoURL.trim()
      };

      await updateUserProfileDetails(currentUser.uid, updatedData);
      
      const newProfileState: UserProfile = {
        ...profile!,
        ...updatedData
      };

      setProfile(newProfileState);
      if (onProfileUpdate) {
        onProfileUpdate(newProfileState);
      }
      
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Error saving profile details:", err);
      setEditError("Une erreur s'est produite lors de la sauvegarde.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogOut = async () => {
    const confirmLogout = window.confirm("Voulez-vous vraiment vous déconnecter ?");
    if (confirmLogout) {
      await signOut(auth);
      onBackToFeed();
    }
  };

  const handleSelectCreatorLocal = (creatorId: string) => {
    if (onSelectCreator) {
      onSelectCreator(creatorId);
    }
  };

  const activeTheme = THEMES[selectedThemeId];

  return (
    <div className="w-full h-full bg-[#121212] flex flex-col overflow-y-auto pb-20 text-zinc-100" id="profile-container">
      {/* Top Header Navigation */}
      <div className="px-4 py-4 border-b border-zinc-800/80 bg-[#121212] flex items-center justify-between sticky top-0 z-30">
        <button 
          onClick={onBackToFeed}
          className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-sm font-black tracking-tight uppercase">
          {profile ? `@${profile.username}` : 'Profil'}
        </span>
        {isOwnProfile ? (
          <button 
            onClick={handleLogOut}
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
            title="Se déconnecter"
          >
            <LogOut size={18} />
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-3 border-rose-500/25 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <div className="flex flex-col items-center">
          
          {/* PROFILE CARD */}
          <div className="px-5 pt-6 pb-2 flex flex-col items-center w-full text-center">
            {/* Avatar */}
            <div className="relative group">
              <img 
                src={profile.photoURL} 
                alt={profile.displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-zinc-800 shadow-xl"
                referrerPolicy="no-referrer"
              />
              {isOwnProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="absolute bottom-0 right-1 bg-rose-500 text-white p-2 rounded-full text-xs shadow-md border-2 border-[#121212] hover:bg-rose-600 transition-colors"
                  title="Modifier le profil"
                >
                  <Camera size={12} />
                </button>
              )}
            </div>

            {/* User Details */}
            <h2 className="text-xl font-bold mt-4 text-white flex items-center gap-1">
              {profile.displayName}
              {isOwnProfile && (
                <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-full font-mono font-medium">
                  Moi
                </span>
              )}
            </h2>
            <span className="text-zinc-500 text-sm font-medium mt-0.5">@{profile.username}</span>

            {/* Followers Stats Cards (Interactive Tabs) */}
            <div className="flex items-center gap-6 mt-5 text-sm font-semibold text-zinc-300 bg-zinc-900/40 p-3 px-6 rounded-2xl border border-zinc-800/40 w-full max-w-sm justify-around shadow-sm">
              <button 
                onClick={() => setActiveTab('publications')}
                className={`flex flex-col items-center transition-colors ${activeTab === 'publications' ? 'text-rose-400' : 'text-zinc-300 hover:text-white'}`}
              >
                <span className="text-lg font-black">{videos.length}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Vidéos</span>
              </button>
              <div className="h-6 w-px bg-zinc-800/80" />
              <button 
                onClick={() => setActiveTab('following')}
                className={`flex flex-col items-center transition-colors ${activeTab === 'following' ? 'text-rose-400' : 'text-zinc-300 hover:text-white'}`}
              >
                <span className="text-lg font-black">{profile.followingCount}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Abonnements</span>
              </button>
              <div className="h-6 w-px bg-zinc-800/80" />
              <button 
                onClick={() => setActiveTab('followers')}
                className={`flex flex-col items-center transition-colors ${activeTab === 'followers' ? 'text-rose-400' : 'text-zinc-300 hover:text-white'}`}
              >
                <span className="text-lg font-black">{profile.followersCount}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Abonnés</span>
              </button>
            </div>

            {/* Follow / DM Buttons for external user */}
            {!isOwnProfile && (
              <div className="flex items-center gap-3 w-full max-w-sm mt-5">
                <button
                  onClick={handleFollowToggle}
                  className={`flex-1 py-2.5 px-4 font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 ${
                    isFollowing 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50' 
                      : 'bg-rose-500 hover:bg-rose-600 text-white'
                  }`}
                  id="profile-follow-btn"
                >
                  {isFollowing ? "Abonné" : "S'abonner"}
                </button>
                <button
                  onClick={handleMessageClick}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-700/50"
                  id="profile-message-btn"
                  title="Message privé"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            )}

            {/* Quick Edit Profile CTA (Only for Me) */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 w-full max-w-sm mt-5">
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Edit3 size={14} className="text-rose-500" />
                  Modifier le profil
                </button>
                
                {/* Theme options toggle */}
                <button
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className={`p-2 rounded-xl border text-xs transition-colors flex items-center justify-center ${
                    showThemePicker 
                      ? 'bg-rose-500 border-rose-500 text-white' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Changer le thème"
                >
                  <Palette size={16} />
                </button>
              </div>
            )}

            {/* Customizable Theme Options Picker Drawer (Only for Me) */}
            {isOwnProfile && showThemePicker && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm mt-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left shadow-lg space-y-3"
              >
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Thèmes sombres disponibles :</span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEMES) as DarkThemeType[]).map((themeKey) => {
                    const t = THEMES[themeKey];
                    const isSelected = selectedThemeId === themeKey;
                    return (
                      <button
                        key={themeKey}
                        onClick={() => onThemeChange(themeKey)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                          isSelected 
                            ? 'bg-zinc-850 border-rose-500 text-white shadow-md' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">{t.name}</span>
                        {isSelected && <Check size={12} className="text-rose-500 font-bold" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Biography Displays */}
            <div className="w-full max-w-sm mt-5 text-left border-t border-zinc-900/60 pt-4">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Biographie</span>
              <p className="text-sm text-zinc-300 mt-1.5 italic leading-relaxed bg-zinc-900/10 p-2.5 rounded-xl border border-zinc-900/40">
                {profile.bio || "Aucune biographie rédigée."}
              </p>
            </div>
          </div>

          {/* TAB BAR NAVIGATION (Publications, Liked, Following, Followers) */}
          <div className="w-full border-t border-b border-zinc-800 bg-[#121212] sticky top-[53px] z-20 flex items-center justify-around text-xs font-bold text-zinc-400">
            <button
              onClick={() => setActiveTab('publications')}
              className={`flex-1 py-4 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'publications'
                  ? 'border-rose-500 text-white font-black'
                  : 'border-transparent hover:text-zinc-200'
              }`}
            >
              <Grid size={14} />
              Publications
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex-1 py-4 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'liked'
                  ? 'border-rose-500 text-white font-black'
                  : 'border-transparent hover:text-zinc-200'
              }`}
            >
              <Heart size={14} />
              Aimées
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-4 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'following'
                  ? 'border-rose-500 text-white font-black'
                  : 'border-transparent hover:text-zinc-200'
              }`}
            >
              <Users size={14} />
              Suivis
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex-1 py-4 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'followers'
                  ? 'border-rose-500 text-white font-black'
                  : 'border-transparent hover:text-zinc-200'
              }`}
            >
              <User size={14} />
              Abonnés
            </button>
          </div>

          {/* TAB CONTENTS CONTAINER */}
          <div className="w-full px-4 py-4">
            
            {/* TAB: PUBLICATIONS (PUBLISHED VIDEOS) */}
            {activeTab === 'publications' && (
              <div>
                {videos.length === 0 ? (
                  <div className="py-16 text-zinc-500 flex flex-col items-center justify-center">
                    <Lock size={36} className="text-zinc-700 mb-2" />
                    <p className="text-xs font-semibold">Aucune vidéo publiée pour le moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {videos.map((vid) => (
                      <div 
                        key={vid.id}
                        onClick={() => onSelectVideo(vid.id)}
                        className="aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden relative cursor-pointer hover:opacity-80 hover:scale-[1.02] transition-all border border-zinc-800 shadow-md group"
                      >
                        <ProfileVideoThumbnail video={vid} />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white drop-shadow flex items-center gap-0.5">
                          ♥ {vid.likesCount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: LIKED (VIDEOS LIKED BY USER) */}
            {activeTab === 'liked' && (
              <div>
                {loadingTabContent ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                  </div>
                ) : likedVideos.length === 0 ? (
                  <div className="py-16 text-zinc-500 flex flex-col items-center justify-center">
                    <Heart size={36} className="text-zinc-700 mb-2" />
                    <p className="text-xs font-semibold">Aucune vidéo aimée pour le moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {likedVideos.map((vid) => (
                      <div 
                        key={vid.id}
                        onClick={() => onSelectVideo(vid.id)}
                        className="aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden relative cursor-pointer hover:opacity-80 hover:scale-[1.02] transition-all border border-zinc-800 shadow-md group"
                      >
                        <video 
                          src={vid.videoUrl} 
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
                        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white drop-shadow flex items-center gap-0.5">
                          ♥ {vid.likesCount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FOLLOWING (CREATORS THE USER FOLLOWS) */}
            {activeTab === 'following' && (
              <div>
                {loadingTabContent ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                  </div>
                ) : followingList.length === 0 ? (
                  <div className="py-16 text-zinc-500 flex flex-col items-center justify-center">
                    <Users size={36} className="text-zinc-700 mb-2" />
                    <p className="text-xs font-semibold">Aucun abonnement enregistré.</p>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    {followingList.map((usr) => (
                      <div 
                        key={usr.id}
                        className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800/40 rounded-xl hover:bg-zinc-900 transition-colors"
                      >
                        <div 
                          onClick={() => handleSelectCreatorLocal(usr.id)}
                          className="flex items-center gap-3 cursor-pointer flex-1 truncate mr-2"
                        >
                          <img 
                            src={usr.photoURL} 
                            alt={usr.displayName}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-white truncate">{usr.displayName}</h4>
                            <span className="text-[10px] text-zinc-500">@{usr.username}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleSelectCreatorLocal(usr.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Voir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FOLLOWERS (PEOPLE FOLLOWING THE USER) */}
            {activeTab === 'followers' && (
              <div>
                {loadingTabContent ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                  </div>
                ) : followersList.length === 0 ? (
                  <div className="py-16 text-zinc-500 flex flex-col items-center justify-center">
                    <User size={36} className="text-zinc-700 mb-2" />
                    <p className="text-xs font-semibold">Aucun abonné enregistré.</p>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    {followersList.map((usr) => (
                      <div 
                        key={usr.id}
                        className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800/40 rounded-xl hover:bg-zinc-900 transition-colors"
                      >
                        <div 
                          onClick={() => handleSelectCreatorLocal(usr.id)}
                          className="flex items-center gap-3 cursor-pointer flex-1 truncate mr-2"
                        >
                          <img 
                            src={usr.photoURL} 
                            alt={usr.displayName}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-white truncate">{usr.displayName}</h4>
                            <span className="text-[10px] text-zinc-500">@{usr.username}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleSelectCreatorLocal(usr.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Voir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      ) : (
        <p className="text-sm text-zinc-500 text-center py-20">Utilisateur introuvable.</p>
      )}

      {/* FULL SCREEN PROFILE EDIT MODAL */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900 sticky top-0">
                <span className="text-sm font-black tracking-tight uppercase flex items-center gap-1.5 text-white">
                  <Edit3 size={16} className="text-rose-500" />
                  Modifier mon profil
                </span>
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-full transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1">
                {editError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                    <Info size={14} className="shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Avatar Preview & Selection */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <img 
                      src={editPhotoURL} 
                      alt="Avatar preview" 
                      className="w-20 h-20 rounded-full object-cover border-4 border-zinc-800 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-rose-500 p-1.5 rounded-full text-white text-[9px] shadow border border-zinc-900">
                      ★
                    </div>
                  </div>

                  {/* Select from Gallery option */}
                  <div className="w-full bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/60 space-y-2 text-left" id="profile-upload-gallery-container">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Camera size={12} className="text-rose-500" />
                      Choisir depuis votre galerie
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="profile-gallery-upload-input"
                      onChange={handleProfilePhotoUpload}
                      className="hidden" 
                    />
                    <label 
                      htmlFor="profile-gallery-upload-input"
                      className="mt-1 cursor-pointer w-full py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-center"
                    >
                      <Camera size={14} />
                      Sélectionner une photo de profil
                    </label>
                  </div>

                  {/* Dicebear generator */}
                  <div className="w-full bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/60 space-y-2.5">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={12} className="text-rose-500" />
                      Générer un avatar pixelisé
                    </span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ex: Maxim, Ninja, Alpha..."
                        value={avatarSeed}
                        onChange={(e) => setAvatarSeed(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyDicebearSeed}
                        className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Générer
                      </button>
                    </div>
                  </div>

                  {/* Preset Photos Selection */}
                  <div className="w-full space-y-2">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Photos de profil recommandées</span>
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_AVATARS.map((av, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditPhotoURL(av.url)}
                          className={`aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${editPhotoURL === av.url ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-transparent'}`}
                          title={av.name}
                        >
                          <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom URL */}
                  <div className="w-full space-y-1.5">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">Lien d'image personnalisé</span>
                    <div className="relative">
                      <input 
                        type="url" 
                        placeholder="https://exemple.com/mon-avatar.jpg"
                        value={editPhotoURL}
                        onChange={(e) => setEditPhotoURL(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <LinkIcon size={12} className="absolute left-3 top-3.5 text-zinc-500" />
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-zinc-800/80 my-4" />

                {/* Display Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    Nom d'affichage
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    Nom d'utilisateur (sans espaces)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="nom_d_utilisateur"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 font-mono"
                    />
                    <span className="absolute left-3 top-3.5 text-zinc-500 font-bold font-mono">@</span>
                  </div>
                </div>

                {/* Bio Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                      Biographie
                    </label>
                    <span className="text-[10px] text-zinc-600 font-medium">
                      {editBio.length} / 150
                    </span>
                  </div>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={150}
                    rows={3}
                    placeholder="Écrivez une biographie courte..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 placeholder-zinc-700"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-end gap-2.5 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isSavingProfile}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-rose-500/10"
                >
                  {isSavingProfile ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Sauvegarder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
