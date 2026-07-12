import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Video as VideoIcon, 
  X, 
  Users, 
  Heart, 
  Send, 
  Camera, 
  ChevronRight, 
  StopCircle, 
  Award, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  Mic
} from 'lucide-react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, orderBy, deleteDoc } from 'firebase/firestore';

interface LiveStream {
  id: string;
  streamerName: string;
  streamerAvatar: string;
  title: string;
  category: string;
  viewerCount: number;
  bgGradient: string;
  simulatedVideoUrl?: string;
}

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  isMe?: boolean;
}

interface FloatingHeart {
  id: number;
  left: number;
  delay: number;
}

interface LiveViewProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  currentUserProfile: UserProfile | null;
  onRequireAuth: () => void;
}

const MOCK_LIVES: LiveStream[] = [
  {
    id: 'live_1',
    streamerName: 'Sarah_Styles 💄',
    streamerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    title: 'Tuto maquillage été glowy & questions/réponses ☀️',
    category: 'Beauté & Mode',
    viewerCount: 1420,
    bgGradient: 'from-pink-500 via-rose-500 to-orange-500',
  },
  {
    id: 'live_2',
    streamerName: 'Gamer_Elite 🎮',
    streamerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    title: 'Top 1 en boucle sur le nouveau mode classé ! 🔥',
    category: 'Gaming',
    viewerCount: 2850,
    bgGradient: 'from-purple-600 via-indigo-700 to-blue-800',
  },
  {
    id: 'live_3',
    streamerName: 'Lucas_Beats 🎧',
    streamerAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    title: 'Production en live de mon prochain EP ! Venez donner votre avis 🎹',
    category: 'Musique',
    viewerCount: 840,
    bgGradient: 'from-amber-500 via-orange-600 to-red-700',
  },
  {
    id: 'live_4',
    streamerName: 'NourritureSaine 🥗',
    streamerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    title: 'Meal prep rapide et healthy pour toute la semaine ! 🥦',
    category: 'Food',
    viewerCount: 510,
    bgGradient: 'from-emerald-500 via-teal-600 to-cyan-700',
  }
];

const SIMULATED_COMMENTS = [
  "Wow super sympa ce live !",
  "Salut d'ici !",
  "Trop cool la qualité",
  "Abonne toi back s'il te plaît !",
  "Génial !!! 😍",
  "MDR c'est excellent",
  "Tu fais ça depuis combien de temps ?",
  "Je viens d'arriver, tu parles de quoi ?",
  "Magnifique !",
  "On t'adore !",
  "Quel talent 👏",
  "Top 1 direct !",
  "Incroyable"
];

const SIMULATED_USERNAMES = [
  "Emma_99", "LeGrandBleu", "Sacha_T", "NicoDev", "Melanie_V",
  "ChocoManiac", "PierreL", "Sofia_R", "User_554", "Arthur_K",
  "Ines_B", "X_Gamer_X", "MusicLover", "AliceParis"
];

export default function LiveView({ isOpen, onClose, currentUser, currentUserProfile, onRequireAuth }: LiveViewProps) {
  const [activeScreen, setActiveScreen] = useState<'lobby' | 'viewer' | 'setup_streamer' | 'streamer' | 'streamer_summary'>('lobby');
  
  // General states
  const [selectedLive, setSelectedLive] = useState<LiveStream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Real lives from Firestore
  const [realLives, setRealLives] = useState<LiveStream[]>([]);
  const [currentLiveId, setCurrentLiveId] = useState<string | null>(null);

  // Co-hosting Voice & webcam states
  const [liveDocData, setLiveDocData] = useState<any>(null);
  const [coHostStream, setCoHostStream] = useState<MediaStream | null>(null);

  // Subscribe to real-time active lives in Firestore
  useEffect(() => {
    if (!isOpen) return;

    const livesRef = collection(db, 'lives');
    const q = query(livesRef, where('status', '==', 'active'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livesList: LiveStream[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        livesList.push({
          id: docSnap.id,
          streamerName: data.streamerName || 'Streamer',
          streamerAvatar: data.streamerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          title: data.title || 'Live sans titre',
          category: data.category || 'Général',
          viewerCount: data.viewerCount || 0,
          bgGradient: data.bgGradient || 'from-zinc-800 to-black',
        } as any);
      });
      setRealLives(livesList);
    }, (err) => {
      console.error("Error listening to lives:", err);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Subscribe to real-time active single live stream document
  useEffect(() => {
    const liveId = selectedLive?.id || currentLiveId;
    if (!liveId || !isOpen) {
      setLiveDocData(null);
      return;
    }

    const liveDocRef = doc(db, 'lives', liveId);
    const unsubscribe = onSnapshot(liveDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLiveDocData(data);
      } else {
        setLiveDocData(null);
      }
    }, (err) => {
      console.error("Error listening to live document:", err);
    });

    return () => unsubscribe();
  }, [selectedLive?.id, currentLiveId, isOpen]);

  // Start local camera for co-host/guest when approved to speak
  useEffect(() => {
    const isMeCoHost = liveDocData?.coHostId === currentUser?.uid && liveDocData?.coHostStatus === 'accepted';
    if (isMeCoHost && !coHostStream) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 }, audio: true })
        .then((stream) => {
          setCoHostStream(stream);
        })
        .catch((err) => {
          console.error("Co-host camera access failed, elegant fallback visual active:", err);
        });
    } else if (!isMeCoHost && coHostStream) {
      coHostStream.getTracks().forEach(track => track.stop());
      setCoHostStream(null);
    }
  }, [liveDocData?.coHostId, liveDocData?.coHostStatus, currentUser]);

  const [inputText, setInputText] = useState('');
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const heartIdCounterRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Setup/Streamer states
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('Humour 🎭');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const streamerVideoRef = useRef<HTMLVideoElement>(null);
  const [streamDuration, setStreamDuration] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [totalHeartsSent, setTotalHeartsSent] = useState(0);

  // Timers/Interval references
  const chatIntervalRef = useRef<any>(null);
  const viewerIntervalRef = useRef<any>(null);
  const durationIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      clearIntervals();
    };
  }, []);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (coHostStream) {
      coHostStream.getTracks().forEach(track => track.stop());
      setCoHostStream(null);
    }
  };

  const clearIntervals = () => {
    if (chatIntervalRef.current) clearInterval(chatIntervalRef.current);
    if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
  };

  // Subscribe to real-time chat messages for the current live stream
  useEffect(() => {
    const liveId = selectedLive?.id || currentLiveId;
    if ((activeScreen === 'viewer' || activeScreen === 'streamer') && liveId) {
      const chatRef = collection(db, 'lives', liveId, 'chat');
      const q = query(chatRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const myName = currentUserProfile?.displayName || currentUser?.email?.split('@')[0] || "Moi";
          messages.push({
            id: docSnap.id,
            username: data.username,
            text: data.text,
            isMe: data.username === myName
          });
        });
        setChatMessages(messages.slice(-50)); // Keep last 50
      }, (err) => {
        console.error("Error listening to live chat:", err);
      });

      return () => unsubscribe();
    }
  }, [activeScreen, selectedLive?.id, currentLiveId, currentUserProfile?.displayName, currentUser?.email]);

  // 1. WATCHING A LIVE STREAM
  const handleJoinLive = async (live: LiveStream) => {
    setSelectedLive(live);
    setViewerCount(live.viewerCount);
    setActiveScreen('viewer');

    const liveId = live.id;
    // Add a real join action comment to the database so everyone sees!
    if (currentUser) {
      try {
        const myName = currentUserProfile?.displayName || currentUser.email?.split('@')[0] || "Spectateur";
        const msgId = 'join_' + Math.random().toString(36).substring(2, 9);
        const chatRef = collection(db, 'lives', liveId, 'chat');
        await setDoc(doc(chatRef, msgId), {
          id: msgId,
          username: myName,
          text: 'a rejoint le live 👋',
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error writing join comment:", err);
      }
    }

    // Still simulate viewer counts fluctuations occasionally for organic feel
    viewerIntervalRef.current = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.floor(Math.random() * 9) - 4; // -4 to +4
        const newCount = Math.max(1, prev + delta);
        return newCount;
      });
    }, 5000);

    // Simulate casual external hearts occasionally so viewer feels standard flow activity
    chatIntervalRef.current = setInterval(() => {
      if (Math.random() > 0.4) {
        triggerFloatingHeart();
      }
    }, 3500);
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (!currentUser) {
      onRequireAuth();
      return;
    }

    const liveId = selectedLive?.id || currentLiveId;
    if (!liveId) return;

    try {
      const myName = currentUserProfile?.displayName || currentUser.email?.split('@')[0] || "Moi";
      const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
      
      const chatRef = collection(db, 'lives', liveId, 'chat');
      await setDoc(doc(chatRef, msgId), {
        id: msgId,
        username: myName,
        text: inputText.trim(),
        createdAt: new Date().toISOString()
      });

      setInputText('');
    } catch (err) {
      console.error("Failed to send real-time message:", err);
    }
  };

  const triggerFloatingHeart = () => {
    const id = heartIdCounterRef.current++;
    const left = Math.floor(Math.random() * 40) + 40; // centered-ish to the right
    const delay = Math.random() * 0.2;
    
    setHearts(prev => [...prev, { id, left, delay }]);
    
    // Remove heart after animation completes to avoid DOM clutter
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 2000);
  };

  // 2. BROADCASTING/LAUNCHING A LIVE
  const handleGoLiveSetup = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setActiveScreen('setup_streamer');
    startCameraPreview();
  };

  const startCameraPreview = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 850, facingMode: 'user' },
        audio: true
      });
      setCameraStream(stream);
      if (streamerVideoRef.current) {
        streamerVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed, fallback design active:", err);
      setCameraError(true);
    }
  };

  const handleStartBroadcasting = async () => {
    if (!streamTitle.trim()) {
      alert("Veuillez saisir un titre pour votre Direct !");
      return;
    }

    if (!currentUser) {
      onRequireAuth();
      return;
    }

    try {
      const liveId = 'live_' + Math.random().toString(36).substring(2, 9);
      const streamerName = currentUserProfile?.displayName || currentUserProfile?.username || currentUser.email?.split('@')[0] || "Streamer";
      const streamerAvatar = currentUserProfile?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

      const bgGradients = [
        'from-pink-500 via-rose-500 to-orange-500',
        'from-purple-600 via-indigo-700 to-blue-800',
        'from-amber-500 via-orange-600 to-red-700',
        'from-emerald-500 via-teal-600 to-cyan-700'
      ];
      const randomBg = bgGradients[Math.floor(Math.random() * bgGradients.length)];

      const liveDocRef = doc(db, 'lives', liveId);
      const newLive = {
        id: liveId,
        streamerId: currentUser.uid,
        streamerName,
        streamerAvatar,
        title: streamTitle,
        category: streamCategory,
        viewerCount: 0,
        bgGradient: randomBg,
        status: 'active',
        coHostId: null,
        coHostName: null,
        coHostAvatar: null,
        coHostStatus: 'none', // none, requesting, accepted
        createdAt: new Date().toISOString()
      };

      await setDoc(liveDocRef, newLive);
      setCurrentLiveId(liveId);
      setSelectedLive(newLive as any);

      // Also write an initial system message in the chat subcollection
      const chatRef = collection(db, 'lives', liveId, 'chat');
      const initialMessageId = 'init_msg';
      await setDoc(doc(chatRef, initialMessageId), {
        id: initialMessageId,
        username: 'Studio 🔴',
        text: 'Votre diffusion en direct commence ! Les spectateurs arrivent...',
        createdAt: new Date().toISOString()
      });

      setActiveScreen('streamer');
      setViewerCount(0);
      setPeakViewers(0);
      setTotalHeartsSent(0);
      setStreamDuration(0);

      // Track duration of stream
      durationIntervalRef.current = setInterval(() => {
        setStreamDuration(prev => prev + 1);
      }, 1000);

      let curViewers = 0;
      viewerIntervalRef.current = setInterval(async () => {
        const joiners = Math.floor(Math.random() * 12) + 2;
        curViewers += joiners;
        setViewerCount(curViewers);
        setPeakViewers(prev => Math.max(prev, curViewers));

        // Update viewer count in Firestore
        try {
          await updateDoc(doc(db, 'lives', liveId), { viewerCount: curViewers });
        } catch (e) {
          console.error(e);
        }

        // Simulate joins in chat by writing them to Firestore subcollection!
        if (Math.random() > 0.3) {
          const randomUser = SIMULATED_USERNAMES[Math.floor(Math.random() * SIMULATED_USERNAMES.length)];
          const joinMsgId = 'join_' + Math.random().toString(36).substring(2, 9);
          await setDoc(doc(chatRef, joinMsgId), {
            id: joinMsgId,
            username: randomUser,
            text: "a rejoint le live 👋",
            createdAt: new Date().toISOString()
          });
        }
      }, 3500);

      // Simulate audience reacting and chatting by writing comments to Firestore chat subcollection
      chatIntervalRef.current = setInterval(async () => {
        if (curViewers === 0) return;
        const randomUser = SIMULATED_USERNAMES[Math.floor(Math.random() * SIMULATED_USERNAMES.length)];
        const randomText = SIMULATED_COMMENTS[Math.floor(Math.random() * SIMULATED_COMMENTS.length)];
        
        const commentMsgId = 'msg_' + Math.random().toString(36).substring(2, 9);
        await setDoc(doc(chatRef, commentMsgId), {
          id: commentMsgId,
          username: randomUser,
          text: randomText,
          createdAt: new Date().toISOString()
        });

        // Rain of hearts from viewers!
        const heartCount = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < heartCount; i++) {
          setTimeout(() => {
            triggerFloatingHeart();
            setTotalHeartsSent(prev => prev + 1);
          }, i * 200);
        }
      }, 4000);

    } catch (err) {
      console.error("Failed to start direct stream:", err);
      alert("Erreur lors du lancement du direct.");
    }
  };

  const handleEndBroadcasting = async () => {
    clearIntervals();
    stopCamera();

    const liveId = currentLiveId;
    if (liveId) {
      try {
        await updateDoc(doc(db, 'lives', liveId), { status: 'ended' });
      } catch (e) {
        console.error("Failed to end live stream:", e);
      }
    }
    setActiveScreen('streamer_summary');
  };

  // Co-host "Request to speak / Ask to speak" Methods
  const handleRequestToSpeak = async () => {
    if (!currentUser || !currentUserProfile) {
      onRequireAuth();
      return;
    }
    const liveId = selectedLive?.id || currentLiveId;
    if (!liveId) return;

    try {
      const myName = currentUserProfile.displayName || currentUserProfile.username || currentUser.email?.split('@')[0] || "Spectateur";
      const myAvatar = currentUserProfile.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.uid}`;
      
      // Update the live doc
      await updateDoc(doc(db, 'lives', liveId), {
        coHostId: currentUser.uid,
        coHostName: myName,
        coHostAvatar: myAvatar,
        coHostStatus: 'requesting'
      });

      // Post chat notice
      const chatRef = collection(db, 'lives', liveId, 'chat');
      const msgId = 'req_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(chatRef, msgId), {
        id: msgId,
        username: 'Studio 🎙️',
        text: `@${myName} a demandé à parler en direct ! 📡`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error requesting speech:", err);
    }
  };

  const handleCancelSpeakRequest = async () => {
    const liveId = selectedLive?.id || currentLiveId;
    if (!liveId) return;

    try {
      await updateDoc(doc(db, 'lives', liveId), {
        coHostId: null,
        coHostName: null,
        coHostAvatar: null,
        coHostStatus: 'none'
      });
    } catch (err) {
      console.error("Error cancelling request:", err);
    }
  };

  const handleStopSpeaking = async () => {
    const liveId = selectedLive?.id || currentLiveId;
    if (!liveId) return;

    try {
      const myName = currentUserProfile?.displayName || currentUserProfile?.username || "Guest";
      
      await updateDoc(doc(db, 'lives', liveId), {
        coHostId: null,
        coHostName: null,
        coHostAvatar: null,
        coHostStatus: 'none'
      });

      // Post chat notice
      const chatRef = collection(db, 'lives', liveId, 'chat');
      const msgId = 'stop_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(chatRef, msgId), {
        id: msgId,
        username: 'Studio 🎙️',
        text: `@${myName} a arrêté de parler.`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error stopping speaking:", err);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const displayedLives = realLives;

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col" id="live-platform-root">
      
      {/* SCREEN 1: LOBBY (VIEW CURRENT LIVES OR GO LIVE) */}
      {activeScreen === 'lobby' && (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 text-white overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h1 className="text-lg font-black tracking-wider uppercase">Directs Live 🔴</h1>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Core selection buttons (Broadcaster vs Viewer) */}
          <div className="p-5 flex flex-col md:flex-row gap-4">
            {/* CTA to launch streamer workspace */}
            <div 
              onClick={handleGoLiveSetup}
              className="flex-1 p-5 rounded-3xl bg-gradient-to-tr from-rose-550 via-rose-600 to-pink-600 hover:brightness-110 cursor-pointer shadow-xl transition-all hover:scale-[1.01] text-left relative overflow-hidden"
              id="cta-go-live-setup"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 -translate-y-12" />
              <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 mb-3.5">
                <VideoIcon size={20} className="text-white animate-pulse" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider">Lancer mon Live !</h3>
              <p className="text-xs text-white/80 mt-1 max-w-xs leading-normal">
                Diffusez votre caméra en direct, interagissez en temps réel avec vos abonnés et partagez la parole !
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/90">
                <span>Accéder au studio</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* CTA to list mock lives */}
            <div className="flex-1 p-5 rounded-3xl bg-zinc-900 border border-zinc-800 text-left relative overflow-hidden flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider">Comment ça marche ?</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-normal max-w-xs">
                  Rejoignez un live existant pour écouter le créateur ou demandez la parole d'un simple clic pour discuter avec lui en direct.
                </p>
              </div>
              <span className="text-[9px] font-bold text-zinc-600 block mt-4">
                Powered by Google Firestore LiveSync
              </span>
            </div>
          </div>

          {/* Active lives list */}
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-3.5 text-left flex items-center gap-1.5">
              <Sparkles size={11} className="text-rose-500" />
              Diffusions actives en ce moment
            </h3>

            {displayedLives.length === 0 ? (
              <div className="border border-dashed border-zinc-850 p-12 rounded-3xl text-center text-zinc-500">
                <Radio size={36} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-xs font-bold text-zinc-400">Aucun direct pour l'instant</p>
                <p className="text-[10px] text-zinc-600 mt-1 leading-normal">Soyez le premier à lancer un direct de haute qualité !</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedLives.map((live) => (
                  <div
                    key={live.id}
                    onClick={() => handleJoinLive(live)}
                    className="group bg-zinc-900 hover:bg-zinc-850/80 border border-zinc-800/80 hover:border-zinc-750 rounded-3xl overflow-hidden cursor-pointer shadow-lg transition-all text-left flex flex-col justify-between h-[155px] relative"
                  >
                    {/* Top category / view tags */}
                    <div className="p-3.5 flex items-center justify-between z-10">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        Direct
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[9px] font-bold text-zinc-300">
                        <Users size={10} className="text-rose-400" />
                        {live.viewerCount >= 1000 ? `${(live.viewerCount / 1000).toFixed(1)}k` : live.viewerCount} spectateurs
                      </div>
                    </div>

                    {/* Bottom details */}
                    <div className="relative p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border-2 border-rose-500/50 overflow-hidden shrink-0">
                        <img src={live.streamerAvatar} alt={live.streamerName} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left overflow-hidden">
                        <span className="text-[10px] text-rose-450 font-extrabold tracking-wide uppercase">@{live.streamerName}</span>
                        <h4 className="text-xs font-bold text-white leading-relaxed mt-0.5 truncate pr-2">{live.title}</h4>
                        <span className="inline-block mt-1 text-[9px] text-zinc-400 font-medium px-2 py-0.5 rounded bg-zinc-850/80 border border-zinc-800">
                          {live.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN 2: VIEWER ROOM (WATCHING A STREAMER) */}
      {activeScreen === 'viewer' && selectedLive && (
        <div className="flex-1 flex flex-col h-full bg-black text-white relative overflow-hidden">
          
          {/* Dual video stream layout rendering if co-host is accepted */}
          <div className="absolute inset-0 flex flex-col justify-stretch">
            {liveDocData?.coHostStatus === 'accepted' ? (
              <div className="flex-1 grid grid-rows-2 h-full w-full">
                {/* Host screen */}
                <div className={`relative bg-gradient-to-tr ${selectedLive.bgGradient} opacity-90 flex flex-col items-center justify-center p-4 border-b border-white/10`}>
                  <div className="flex flex-col items-center gap-2 text-center select-none">
                    <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center border border-white/20 backdrop-blur-md shadow-2xl scale-105">
                      <Radio size={26} className="text-white animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight">{selectedLive.streamerName}</h3>
                      <p className="text-[10px] text-white/70">Broadcaster principal</p>
                    </div>
                  </div>
                </div>

                {/* Co-host speaker screen */}
                <div className="relative bg-zinc-950 flex flex-col items-center justify-center p-4">
                  {liveDocData?.coHostId === currentUser?.uid && coHostStream ? (
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = coHostStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : (
                    /* Display elegant speaking indicators */
                    <div className="flex flex-col items-center gap-2 text-center select-none z-10">
                      <div className="relative">
                        <img src={liveDocData?.coHostAvatar} className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400 shadow-xl" />
                        <span className="absolute -bottom-1 -right-1 bg-cyan-400 p-1 rounded-full text-black">
                          <Mic size={10} className="fill-black" />
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-black tracking-tight text-cyan-400">@{liveDocData?.coHostName}</h3>
                        <p className="text-[9px] text-zinc-400">En direct avec le micro</p>
                      </div>
                      <div className="flex gap-1 items-center justify-center h-4 mt-1">
                        <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        <span className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Normal single broadcaster layout */
              <div className={`absolute inset-0 bg-gradient-to-tr ${selectedLive.bgGradient} opacity-50 flex items-center justify-center`}>
                <div className="flex flex-col items-center gap-4 text-center select-none">
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border border-white/25 backdrop-blur-xl shadow-2xl scale-110">
                    <Radio size={40} className="text-white animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{selectedLive.streamerName.split(' ')[0]} est en Direct</h2>
                    <p className="text-xs text-white/60 font-medium">Flux audio & vidéo de haute qualité</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vignette filters for UI readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/75 pointer-events-none z-10" />

          {/* Top Panel (Host Info & Viewers) */}
          <div className="relative p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/50 to-transparent">
            {/* Host badge */}
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <img src={selectedLive.streamerAvatar} alt="" className="w-6 h-6 rounded-full object-cover border border-rose-500" />
              <div className="text-left leading-none">
                <p className="text-[10px] font-black">{selectedLive.streamerName}</p>
                <span className="text-[8px] text-rose-400 font-bold uppercase tracking-widest flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping" />
                  Direct
                </span>
              </div>
            </div>

            {/* Viewers count & Close */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold">
                <Users size={11} className="text-rose-400" />
                {viewerCount}
              </div>
              <button
                onClick={() => {
                  clearIntervals();
                  setActiveScreen('lobby');
                }}
                className="w-8 h-8 flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 hover:bg-zinc-800 rounded-full transition-colors"
                id="leave-viewer-btn"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Room Content (Chat feed & Interactions) */}
          <div className="flex-1 relative z-20 flex flex-col justify-end min-h-0 pointer-events-none">
            
            {/* Chat list overlay (Scrolls at the bottom left) */}
            <div className="p-4 max-h-[35%] w-full overflow-y-auto pointer-events-auto select-text flex flex-col gap-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-left bg-black/30 backdrop-blur-sm p-2 rounded-xl border border-white/5 max-w-[85%] self-start flex items-start gap-1.5">
                  <span className={`text-[10px] font-black shrink-0 ${msg.isMe ? 'text-cyan-400' : 'text-rose-400'}`}>
                    @{msg.username} :
                  </span>
                  <span className="text-xs text-zinc-100 font-medium break-all leading-normal">
                    {msg.text}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Interaction bar (Likes, speak request, keyboard) */}
            <div className="p-4 flex items-center gap-2.5 pointer-events-auto bg-gradient-to-t from-black/80 to-transparent">
              <form onSubmit={handleSendChatMessage} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Envoyer un mot sympa..."
                  className="flex-1 bg-black/40 border border-white/15 outline-none rounded-xl text-xs px-3.5 py-2.5 focus:border-rose-500 transition-colors placeholder-zinc-500 text-white font-medium"
                />
                <button
                  type="submit"
                  className="w-10 h-10 flex items-center justify-center bg-rose-500 hover:bg-rose-600 rounded-xl text-white transition-colors shrink-0 shadow-lg active:scale-90"
                >
                  <Send size={15} />
                </button>
              </form>

              {/* SPEAK / MIC REQUEST BUTTONS */}
              {liveDocData?.coHostId === currentUser?.uid ? (
                liveDocData?.coHostStatus === 'requesting' ? (
                  <button
                    onClick={handleCancelSpeakRequest}
                    className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-lg animate-pulse"
                    title="En attente... Cliquez pour annuler."
                  >
                    En attente...
                  </button>
                ) : liveDocData?.coHostStatus === 'accepted' ? (
                  <button
                    onClick={handleStopSpeaking}
                    className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-lg flex items-center gap-1.5"
                    title="Quitter la discussion vocale"
                  >
                    <StopCircle size={12} />
                    <span>Quitter</span>
                  </button>
                ) : null
              ) : liveDocData?.coHostStatus === 'accepted' ? (
                <div className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[8px] font-black uppercase rounded-xl shrink-0">
                  @{(liveDocData?.coHostName || "Guest").split(' ')[0]} parle
                </div>
              ) : (
                <button
                  onClick={handleRequestToSpeak}
                  className="w-10 h-10 flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 rounded-xl text-black shadow-lg shrink-0 transition-transform active:scale-90"
                  title="Demander à parler en direct"
                >
                  <Mic size={16} />
                </button>
              )}

              {/* Heart/Like clicker */}
              <button
                onClick={triggerFloatingHeart}
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white shadow-lg shrink-0 transition-transform active:scale-90 relative"
                id="viewer-heart-btn"
              >
                <Heart size={18} className="fill-rose-500 text-rose-500" />
              </button>
            </div>
          </div>

          {/* Hearts Animation Stage */}
          <div className="absolute right-6 bottom-16 w-24 h-64 pointer-events-none z-30 overflow-hidden">
            <AnimatePresence>
              {hearts.map((heart) => (
                <motion.div
                  key={heart.id}
                  initial={{ opacity: 0, y: 150, scale: 0.5, x: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0], 
                    y: 0, 
                    scale: [0.5, 1.2, 1, 0.8],
                    x: [0, Math.sin(heart.id) * 20, Math.sin(heart.id) * -10, Math.sin(heart.id) * 30]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: 'easeOut', delay: heart.delay }}
                  style={{ left: `${heart.left}%` }}
                  className="absolute bottom-0 text-rose-500 filter drop-shadow"
                >
                  <Heart size={24} className="fill-rose-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* SCREEN 3: STREAMER SETUP (CONFIG TITLE, CAMERA PREVIEW) */}
      {activeScreen === 'setup_streamer' && (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 text-white overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40">
            <h1 className="text-sm font-black tracking-wider uppercase">Paramétrer mon Live 🔴</h1>
            <button 
              onClick={() => {
                stopCamera();
                setActiveScreen('lobby');
              }}
              className="p-1.5 hover:bg-zinc-850 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Camera preview area */}
          <div className="relative flex-1 bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-sm h-[60%] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/80 relative flex items-center justify-center">
              
              {cameraError ? (
                /* Fallback Graphic */
                <div className="p-6 text-center space-y-3.5 select-none z-10">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                    <Camera size={26} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Caméra virtuelle active</h4>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-xs leading-normal">
                      Aucune webcam détectée ou permission refusée. Le studio simulera un flux de haute qualité !
                    </p>
                  </div>
                </div>
              ) : (
                /* Real Camera Video Output */
                <video
                  ref={streamerVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}

              {/* Camera Indicator Info */}
              <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-zinc-300 border border-white/5 flex items-center gap-1.5 z-15">
                <Camera size={12} className="text-cyan-400" />
                <span>Caméra active</span>
              </div>
            </div>
          </div>

          {/* Title and category selection panel */}
          <div className="p-5 space-y-4 bg-zinc-900/80 border-t border-zinc-850">
            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">Titre du Direct</label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Ex: Soirée Chill & Discussions... 🚀"
                className="w-full bg-zinc-950 text-xs px-4 py-3.5 rounded-xl text-white outline-none border border-zinc-800 focus:border-rose-500 transition-colors font-medium"
                id="stream-title-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2">Thème / Catégorie</label>
              <select
                value={streamCategory}
                onChange={(e) => setStreamCategory(e.target.value)}
                className="w-full bg-zinc-950 text-xs px-4 py-3.5 rounded-xl text-white outline-none border border-zinc-800 focus:border-rose-500 transition-colors font-bold"
                id="stream-category-select"
              >
                <option value="Humour 🎭">Humour 🎭</option>
                <option value="Musique 🎧">Musique 🎧</option>
                <option value="Gaming 🎮">Gaming 🎮</option>
                <option value="Tech 💻">Tech 💻</option>
                <option value="Beauté & Mode 💄">Beauté & Mode 💄</option>
                <option value="Food 🍔">Food 🍔</option>
                <option value="Sports 🛹">Sports 🛹</option>
              </select>
            </div>

            <button
              onClick={handleStartBroadcasting}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-xl hover:brightness-115 active:scale-98 transition-all"
              id="start-broadcast-btn"
            >
              Lancer le Direct 🔴
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 4: STREAMER ROOM (BROADCASTING ACTIVE) */}
      {activeScreen === 'streamer' && (
        <div className="flex-1 flex flex-col h-full bg-black text-white relative overflow-hidden">
          
          {/* FLOATING INCOMING CO-HOST REQUEST OVERLAY */}
          {liveDocData?.coHostStatus === 'requesting' && (
            <div className="absolute top-16 left-4 right-4 bg-zinc-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-rose-550 shadow-2xl z-40 flex items-center justify-between gap-3 pointer-events-auto">
              <div className="flex items-center gap-2.5 text-left min-w-0">
                <img src={liveDocData.coHostAvatar} className="w-8 h-8 rounded-full border border-zinc-800 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">@{liveDocData.coHostName}</p>
                  <p className="text-[10px] text-zinc-400">Demande à parler en direct</p>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'lives', liveDocData.id), {
                      coHostStatus: 'accepted'
                    });
                    const chatRef = collection(db, 'lives', liveDocData.id, 'chat');
                    const msgId = 'sys_' + Math.random().toString(36).substring(2, 9);
                    await setDoc(doc(chatRef, msgId), {
                      id: msgId,
                      username: 'Studio 🔴',
                      text: `@${liveDocData.coHostName} a rejoint la parole en direct ! 🎙️`,
                      createdAt: new Date().toISOString()
                    });
                  }}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase tracking-wider transition-colors"
                >
                  Accepter
                </button>
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'lives', liveDocData.id), {
                      coHostId: null,
                      coHostName: null,
                      coHostAvatar: null,
                      coHostStatus: 'none'
                    });
                  }}
                  className="px-2.5 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[9px] font-black rounded-lg uppercase tracking-wider transition-colors"
                >
                  Décliner
                </button>
              </div>
            </div>
          )}

          {/* Video stream rendering - split if cohost accepted */}
          <div className="absolute inset-0 bg-zinc-950">
            {liveDocData?.coHostStatus === 'accepted' ? (
              <div className="w-full h-full grid grid-rows-2">
                {/* Host screen */}
                <div className="relative bg-black flex items-center justify-center border-b border-white/10">
                  {cameraError ? (
                    <div className="text-center p-4">
                      <Radio size={30} className="text-rose-400 animate-pulse mx-auto mb-2" />
                      <p className="text-xs">Caméra active</p>
                    </div>
                  ) : (
                    <video
                      ref={streamerVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    />
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-bold z-20">
                    Vous (Host)
                  </span>
                </div>

                {/* Speaking Guest screen */}
                <div className="relative bg-zinc-950 flex flex-col items-center justify-center p-4">
                  <div className="flex flex-col items-center gap-2 text-center select-none z-10">
                    <div className="relative">
                      <img src={liveDocData?.coHostAvatar} className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400 shadow-xl" />
                      <span className="absolute -bottom-1 -right-1 bg-cyan-400 p-1.5 rounded-full text-black">
                        <Mic size={10} />
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black tracking-tight text-cyan-400">@{liveDocData?.coHostName}</h3>
                      <p className="text-[9px] text-zinc-400">En direct avec le micro</p>
                    </div>
                    <div className="flex gap-1 items-center justify-center h-4 mt-1">
                      <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                    </div>
                  </div>
                  
                  {/* Option to stop speaker */}
                  <button
                    onClick={async () => {
                      await updateDoc(doc(db, 'lives', liveDocData.id), {
                        coHostId: null,
                        coHostName: null,
                        coHostAvatar: null,
                        coHostStatus: 'none'
                      });
                    }}
                    className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-rose-650 hover:bg-rose-700 text-white text-[8px] font-black uppercase tracking-wider rounded-lg shadow"
                  >
                    Couper parole
                  </button>
                </div>
              </div>
            ) : (
              /* Normal single broadcaster layout */
              cameraError ? (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-rose-950/40 to-indigo-950/40 flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-5">
                    <div className="w-24 h-24 rounded-full border border-rose-500 bg-rose-500/10 flex items-center justify-center scale-110">
                      <Radio size={40} className="text-rose-400 animate-pulse" />
                    </div>
                    <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-wider text-rose-400">Diffusion active</p>
                  <h4 className="text-sm font-bold text-white mt-1 max-w-xs">{streamTitle}</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Votre flux audio micro est diffusé en direct.</p>
                </div>
              ) : (
                <video
                  ref={streamerVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/65 pointer-events-none z-10" />

          {/* Top panel (Broadcaster indicators) */}
          <div className="relative p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/50 to-transparent">
            {/* Live badge & Title info */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500 text-[10px] font-black uppercase tracking-wider rounded-full shadow-md animate-pulse shrink-0">
                🔴 EN DIRECT
              </span>
              <div className="text-left bg-black/40 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/5 truncate max-w-[150px]">
                <p className="text-[10px] font-bold text-white truncate">{streamTitle}</p>
                <p className="text-[8px] text-rose-450 font-bold uppercase">{streamCategory}</p>
              </div>
            </div>

            {/* Viewer counter, duration timer, and End Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-[9px] font-mono font-bold text-cyan-400 border border-white/5">
                {formatDuration(streamDuration)}
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-[9px] font-bold text-zinc-200 border border-white/5">
                <Users size={10} className="text-rose-400 animate-pulse" />
                {viewerCount}
              </div>
              <button
                onClick={handleEndBroadcasting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-1 border border-rose-500/20"
                id="end-broadcast-btn"
              >
                <StopCircle size={12} />
                <span>Arrêter</span>
              </button>
            </div>
          </div>

          {/* Broadcaster room details (Viewer Chat log) */}
          <div className="flex-1 relative z-20 flex flex-col justify-end min-h-0 pointer-events-none p-4">
            <div className="max-h-[40%] w-full overflow-y-auto pointer-events-auto select-text flex flex-col gap-2 bg-black/25 backdrop-blur-sm p-3.5 rounded-2xl border border-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
                <MessageSquare size={10} className="text-rose-500" />
                Fil des spectateurs
              </span>
              {chatMessages.slice(-20).map((msg) => (
                <div key={msg.id} className="text-left flex items-start gap-1.5">
                  <span className="text-[10px] font-black text-rose-400 shrink-0">@{msg.username} :</span>
                  <span className="text-xs text-zinc-200 font-medium leading-relaxed">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Floating Hearts Stage */}
          <div className="absolute right-6 bottom-16 w-24 h-64 pointer-events-none z-30 overflow-hidden">
            <AnimatePresence>
              {hearts.map((heart) => (
                <motion.div
                  key={heart.id}
                  initial={{ opacity: 0, y: 150, scale: 0.5, x: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0], 
                    y: 0, 
                    scale: [0.5, 1.2, 1, 0.8],
                    x: [0, Math.sin(heart.id) * 20, Math.sin(heart.id) * -10, Math.sin(heart.id) * 30]
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: 'easeOut', delay: heart.delay }}
                  style={{ left: `${heart.left}%` }}
                  className="absolute bottom-0 text-rose-500 filter drop-shadow"
                >
                  <Heart size={24} className="fill-rose-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* SCREEN 5: STREAMER SUMMARY PAGE (METRICS SHOWCASE) */}
      {activeScreen === 'streamer_summary' && (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 text-white p-6 justify-center items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-3xl p-6 shadow-2xl space-y-6"
          >
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500 scale-105">
              <Award size={30} className="animate-bounce" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Direct Terminé ! 🎉</h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Félicitations pour votre diffusion ! Voici vos statistiques clés de performance en direct :</p>
            </div>

            {/* Grid Metrics */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 text-left">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Durée Totale</span>
                <span className="text-sm font-black text-white mt-1.5 block font-mono">{formatDuration(streamDuration)}</span>
              </div>
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 text-left">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Spectateurs max</span>
                <span className="text-sm font-black text-white mt-1.5 block font-mono">{peakViewers}</span>
              </div>
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 text-left col-span-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block flex items-center gap-1">
                  <Heart size={10} className="text-rose-500 fill-rose-500" />
                  Total J'aime / Coeurs Reçus
                </span>
                <span className="text-base font-black text-rose-400 mt-1.5 block font-mono">{totalHeartsSent} j'aime</span>
              </div>
            </div>

            {/* Back to lobby */}
            <button
              onClick={() => {
                setActiveScreen('lobby');
              }}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-lg"
              id="summary-back-btn"
            >
              Retourner aux directs
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
