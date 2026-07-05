import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  seedVideosIfEmpty, 
  getUserProfile, 
  createOrUpdateUser, 
  getFollowingIds,
  listenToNotifications,
  listenToUserProfile
} from './dbUtils';
import { Video, UserProfile, DarkThemeType, THEMES } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Inbox, 
  User as UserIcon, 
  Plus, 
  SlidersHorizontal,
  VolumeX,
  Volume2,
  Sparkles,
  Search,
  CheckCircle2
} from 'lucide-react';

// Subcomponents
import VideoCard from './components/VideoCard';
import AuthModal from './components/AuthModal';
import UploadModal from './components/UploadModal';
import InboxView from './components/InboxView';
import ProfileView from './components/ProfileView';
import PreferencesModal from './components/PreferencesModal';

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Theme states
  const [selectedThemeId, setSelectedThemeId] = useState<DarkThemeType>('onyx');

  // Video states
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false); // default unmuted so voiceover audio plays automatically

  // Navigation states
  const [activeTab, setActiveTab] = useState<'feed' | 'inbox' | 'profile'>('feed');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Following list to filter following feed
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const feedContainerRef = useRef<HTMLDivElement>(null);

  // 1. Initial Seeding and Auth listeners
  useEffect(() => {
    // Seed database with mock videos on startup if empty
    seedVideosIfEmpty();

    let unsubProfile: (() => void) | null = null;
    let unsubNotifs: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Load or create user profile
        await createOrUpdateUser({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });

        // Listen to user profile updates in real-time
        if (unsubProfile) unsubProfile();
        unsubProfile = listenToUserProfile(user.uid, (profile) => {
          if (profile) {
            setCurrentUserProfile(profile);
          }
        });

        // Fetch following IDs
        const following = await getFollowingIds(user.uid);
        setFollowingIds(following);

        // Listen to notifications to show badge
        if (unsubNotifs) unsubNotifs();
        unsubNotifs = listenToNotifications(user.uid, (notifs) => {
          setUnreadCount(notifs.filter(n => !n.read).length);
        });
      } else {
        setCurrentUser(null);
        setCurrentUserProfile(null);
        setFollowingIds([]);
        setUnreadCount(0);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        if (unsubNotifs) {
          unsubNotifs();
          unsubNotifs = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  // 2. Real-time updates for Videos to catch Likes/Comments counts instantly
  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribeVideos = onSnapshot(q, (snapshot) => {
      const vids = snapshot.docs.map(doc => doc.data() as Video);
      setAllVideos(vids);
    }, (err) => {
      console.error("Error listening to videos:", err);
    });

    return () => unsubscribeVideos();
  }, []);

  // 3. Filter videos based on Tab (For You / Following) and User Preferences
  useEffect(() => {
    let filtered = [...allVideos];

    // Filter by specific following feed
    if (feedType === 'following') {
      if (!currentUser) {
        filtered = []; // Guests have no following feed
      } else {
        filtered = allVideos.filter(vid => followingIds.includes(vid.creatorId));
      }
    } else {
      // "For You" Feed: Apply preferences filter if user profile has preferences
      if (currentUserProfile?.preferences && currentUserProfile.preferences.length > 0) {
        filtered = allVideos.filter(vid => currentUserProfile.preferences?.includes(vid.category));
        
        // If everything is filtered out, fallback to all videos
        if (filtered.length === 0) {
          filtered = [...allVideos];
        }
      }

      // Apply horizontal manual tag filter
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(vid => vid.category === selectedCategory);
      }
    }

    setFilteredVideos(filtered);
    setCurrentVideoIndex(0);
    // Reset scroll of feed
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTop = 0;
    }
  }, [allVideos, feedType, followingIds, currentUserProfile, selectedCategory, currentUser]);

  // Track index scrolling on feed
  const handleFeedScroll = () => {
    const container = feedContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    
    // Calculate current video card in view
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== currentVideoIndex && newIndex >= 0 && newIndex < filteredVideos.length) {
      setCurrentVideoIndex(newIndex);
    }
  };

  const handleRequireAuth = () => {
    setShowAuthModal(true);
  };

  const handleUploadSuccess = () => {
    alert("Votre vidéo a été publiée avec succès ! Elle apparaîtra bientôt dans le flux.");
    setFeedType('foryou');
    setSelectedCategory('all');
    setActiveTab('feed');
  };

  const handlePreferencesSaved = (updatedPrefs: string[]) => {
    if (currentUserProfile) {
      setCurrentUserProfile({
        ...currentUserProfile,
        preferences: updatedPrefs
      });
    }
  };

  const handleSelectCreatorProfile = (creatorId: string) => {
    setSelectedProfileId(creatorId);
    setActiveTab('profile');
  };

  const handleSelectVideoGrid = (videoId: string) => {
    // Find the video and go back to feed showing it
    const vidIndex = filteredVideos.findIndex(v => v.id === videoId);
    if (vidIndex !== -1) {
      setCurrentVideoIndex(vidIndex);
      setActiveTab('feed');
      // Scroll to that video card
      setTimeout(() => {
        const container = feedContainerRef.current;
        if (container) {
          container.scrollTop = vidIndex * container.clientHeight;
        }
      }, 100);
    } else {
      // If not in current filtered list, show in overall list
      const overallIndex = allVideos.findIndex(v => v.id === videoId);
      if (overallIndex !== -1) {
        setSelectedCategory('all');
        setFeedType('foryou');
        setFilteredVideos([...allVideos]);
        setCurrentVideoIndex(overallIndex);
        setActiveTab('feed');
        setTimeout(() => {
          const container = feedContainerRef.current;
          if (container) {
            container.scrollTop = overallIndex * container.clientHeight;
          }
        }, 100);
      }
    }
  };

  const handleAddVideoClick = () => {
    if (!currentUser) {
      handleRequireAuth();
    } else {
      setShowUploadModal(true);
    }
  };

  const activeTheme = THEMES[selectedThemeId];

  return (
    <div className={`w-full h-screen ${activeTheme.background} flex justify-center text-white overflow-hidden`}>
      {/* 
        Responsive Wrapper:
        Centers the viewport on desktop and laptop devices to render a gorgeous TikTok phone UI,
        while scaling to full viewport on native mobile devices for maximum immersion!
      */}
      <div className={`w-full max-w-[460px] h-full ${activeTheme.card} relative flex flex-col shadow-2xl border-x border-zinc-900 overflow-hidden`}>
        
        {/* VIEW: MAIN FEED */}
        {activeTab === 'feed' && (
          <div className="flex-1 flex flex-col h-full relative" id="feed-view-container">
            {/* Top Navigation Tabs (For You / Following) */}
            <div className="absolute top-0 inset-x-0 py-4 px-6 flex items-center justify-between z-30 bg-gradient-to-b from-black/60 to-transparent">
              {/* Left filter toggle */}
              <button 
                onClick={() => setShowPreferencesModal(true)}
                className="p-2.5 bg-black/40 hover:bg-black/60 active:bg-rose-500/10 rounded-full transition-all border border-white/15 backdrop-blur-md text-white shadow-lg shrink-0"
                id="filter-pref-launcher"
                title="Filtrer mes préférences"
              >
                <SlidersHorizontal size={16} className="text-white" />
              </button>

              {/* Feed Mode Selectors */}
              <div className="flex items-center gap-5">
                <button
                  onClick={() => {
                    setFeedType('foryou');
                    setSelectedCategory('all');
                  }}
                  className={`text-sm font-black tracking-wide pb-1.5 border-b-2 transition-all ${
                    feedType === 'foryou' ? 'border-rose-500 text-white scale-105' : 'border-transparent text-white/50'
                  }`}
                  id="feed-foryou-btn"
                >
                  Pour toi
                </button>
                <button
                  onClick={() => {
                    if (!currentUser) {
                      handleRequireAuth();
                    } else {
                      setFeedType('following');
                      setSelectedCategory('all');
                    }
                  }}
                  className={`text-sm font-black tracking-wide pb-1.5 border-b-2 transition-all ${
                    feedType === 'following' ? 'border-rose-500 text-white scale-105' : 'border-transparent text-white/50'
                  }`}
                  id="feed-following-btn"
                >
                  Abonnements
                </button>
              </div>

              {/* Right search / info */}
              <div className="w-10 h-10 flex items-center justify-center bg-black/40 border border-white/15 backdrop-blur-md rounded-full text-zinc-300">
                <Sparkles size={16} className="text-rose-500 animate-pulse" />
              </div>
            </div>

            {/* Horizontal Video Category Quick Toggles (Only on For You feed) */}
            {feedType === 'foryou' && (
              <div className="absolute top-16 inset-x-0 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none z-30">
                {['all', 'comedy', 'tech', 'music', 'sports', 'food', 'nature'].map((cat) => {
                  const labelMap: Record<string, string> = {
                    all: "Tous 🌌",
                    comedy: "Humour 🎭",
                    tech: "Tech 💻",
                    music: "Musique 🎧",
                    sports: "Sports 🛹",
                    food: "Food 🍔",
                    nature: "Nature 🌲"
                  };
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-md shrink-0 border ${
                        isSelected 
                          ? 'bg-rose-500 text-white border-rose-500 scale-105' 
                          : 'bg-black/40 hover:bg-black/60 border-white/10 text-zinc-300 backdrop-blur-md'
                      }`}
                    >
                      {labelMap[cat]}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Vertical Video Scroll Feed */}
            {filteredVideos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
                <Search size={44} className="text-zinc-600 mb-3" />
                <h3 className="text-lg font-bold text-white">Aucun contenu trouvé</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
                  {feedType === 'following' 
                    ? "Les vidéos des créateurs que vous suivez apparaîtront ici. Commencez par vous abonner à des créateurs dans le flux !"
                    : "Essayez d'élargir vos filtres de préférences pour découvrir de magnifiques vidéos de stock !"}
                </p>
                <button
                  onClick={() => {
                    setFeedType('foryou');
                    setSelectedCategory('all');
                    if (currentUserProfile) {
                      setShowPreferencesModal(true);
                    }
                  }}
                  className="mt-6 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  Découvrir du contenu
                </button>
              </div>
            ) : (
              <div 
                ref={feedContainerRef}
                onScroll={handleFeedScroll}
                className="flex-1 snap-y snap-mandatory h-full overflow-y-scroll scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
                id="vertical-feed-snap"
              >
                {filteredVideos.map((video, index) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    currentUser={currentUser}
                    currentUserProfile={currentUserProfile}
                    isActive={index === currentVideoIndex}
                    isMuted={isMuted}
                    onToggleMute={() => setIsMuted(!isMuted)}
                    onRequireAuth={handleRequireAuth}
                    onSelectCreator={handleSelectCreatorProfile}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: INBOX (CHATS & NOTIFICATIONS) */}
        {activeTab === 'inbox' && (
          <div className="flex-1 h-full overflow-hidden">
            <InboxView
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              onRequireAuth={handleRequireAuth}
              onSelectCreator={handleSelectCreatorProfile}
            />
          </div>
        )}

        {/* VIEW: PROFILE (MINE OR CREATORS) */}
        {activeTab === 'profile' && (
          <div className="flex-1 h-full overflow-hidden">
            <ProfileView
              profileId={selectedProfileId || currentUser?.uid || ''}
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              selectedThemeId={selectedThemeId}
              onThemeChange={setSelectedThemeId}
              onRequireAuth={handleRequireAuth}
              onOpenDM={() => setActiveTab('inbox')}
              onSelectVideo={handleSelectVideoGrid}
              onBackToFeed={() => {
                setSelectedProfileId(null);
                setActiveTab('feed');
              }}
              onProfileUpdate={(updatedProfile) => {
                setCurrentUserProfile(updatedProfile);
              }}
              onSelectCreator={handleSelectCreatorProfile}
            />
          </div>
        )}

        {/* BOTTOM GLOBAL NAVIGATION TAB BAR */}
        <div className="h-16 bg-black border-t border-zinc-900/60 flex items-center justify-around px-4 sticky bottom-0 z-40 shrink-0">
          {/* Home Icon */}
          <button
            onClick={() => {
              setSelectedProfileId(null);
              setActiveTab('feed');
            }}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'feed' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            id="nav-home-btn"
          >
            <Home size={20} className={activeTab === 'feed' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-black tracking-wide">Accueil</span>
          </button>

          {/* Preferences Quick Trigger */}
          <button
            onClick={() => setShowPreferencesModal(true)}
            className="flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            id="nav-preferences-btn"
          >
            <SlidersHorizontal size={20} />
            <span className="text-[9px] font-bold tracking-wide">Filtres</span>
          </button>

          {/* Plus Add Video Button (Custom TikTok design) */}
          <button
            onClick={handleAddVideoClick}
            className="relative flex items-center justify-center w-12 h-8 hover:scale-105 active:scale-95 transition-all"
            id="nav-publish-btn"
            title="Publier"
          >
            <div className="absolute inset-0 bg-cyan-400 rounded-lg translate-x-[-3px]" />
            <div className="absolute inset-0 bg-rose-500 rounded-lg translate-x-[3px]" />
            <div className="absolute inset-y-0 inset-x-[2px] bg-white text-zinc-950 rounded-lg flex items-center justify-center z-10 font-bold">
              <Plus size={18} className="stroke-[3px]" />
            </div>
          </button>

          {/* Inbox Icon with Notification count badge */}
          <button
            onClick={() => {
              if (!currentUser) {
                handleRequireAuth();
              } else {
                setSelectedProfileId(null);
                setActiveTab('inbox');
              }
            }}
            className={`flex flex-col items-center gap-1 transition-colors relative ${
              activeTab === 'inbox' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            id="nav-inbox-btn"
          >
            <Inbox size={20} className={activeTab === 'inbox' ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-black tracking-wide">Boîte</span>
            
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Profile Icon */}
          <button
            onClick={() => {
              if (!currentUser) {
                handleRequireAuth();
              } else {
                setSelectedProfileId(null);
                setActiveTab('profile');
              }
            }}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile' && !selectedProfileId ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            id="nav-profile-btn"
          >
            <UserIcon size={20} className={activeTab === 'profile' && !selectedProfileId ? 'stroke-[2.5px]' : ''} />
            <span className="text-[9px] font-black tracking-wide">Profil</span>
          </button>
        </div>

        {/* MODAL POPUPS / DRAWERS */}
        <AnimatePresence>
          {showAuthModal && (
            <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
            />
          )}

          {showUploadModal && (
            <UploadModal
              isOpen={showUploadModal}
              onClose={() => setShowUploadModal(false)}
              currentUser={currentUser}
              onUploadSuccess={handleUploadSuccess}
            />
          )}

          {showPreferencesModal && (
            <PreferencesModal
              isOpen={showPreferencesModal}
              onClose={() => setShowPreferencesModal(false)}
              currentUserProfile={currentUserProfile}
              onSaveSuccess={handlePreferencesSaved}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
