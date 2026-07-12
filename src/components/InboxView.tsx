import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  MessageSquare, 
  Send, 
  Trash2, 
  Check, 
  CheckCheck, 
  Sparkles, 
  UserPlus, 
  Heart, 
  MessageCircle, 
  ArrowLeft,
  Users,
  Phone,
  Video,
  Image,
  Mic,
  Paperclip,
  X,
  Play,
  Volume2,
  Camera,
  StopCircle,
  PhoneOff,
  PhoneCall,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  listenToUserChats, 
  listenToChatMessages, 
  sendDirectMessage, 
  markChatAsRead,
  listenToNotifications,
  markNotificationAsRead,
  clearAllNotifications,
  createOrGetChat,
  getAllCreators,
  checkMutualFollow,
  createCallDoc,
  listenToActiveCalls,
  listenToSpecificCall,
  updateCallStatus
} from '../dbUtils';
import { Chat, Message, Notification, UserProfile } from '../types';

interface InboxViewProps {
  currentUser: User | null;
  currentUserProfile: UserProfile | null;
  onRequireAuth: () => void;
  onSelectCreator: (creatorId: string) => void;
  onNotificationAction?: (type: 'video' | 'profile' | 'chat', targetId: string) => void;
}

export default function InboxView({ 
  currentUser, 
  currentUserProfile, 
  onRequireAuth, 
  onSelectCreator,
  onNotificationAction 
}: InboxViewProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [availableCreators, setAvailableCreators] = useState<UserProfile[]>([]);
  const [showStartChat, setShowStartChat] = useState(false);
  const [checkingMutual, setCheckingMutual] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);

  // Calling & VoIP State
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [outgoingCall, setOutgoingCall] = useState<any>(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Media Attachment State
  const [attachment, setAttachment] = useState<{ dataUrl: string; type: 'image' | 'video' | 'audio'; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authenticate check
  useEffect(() => {
    if (!currentUser) {
      onRequireAuth();
    }
  }, [currentUser, onRequireAuth]);

  // Listen to user chats
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToUserChats(currentUser.uid, (chatsList) => {
      setChats(chatsList);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listen to messages of active chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }
    const unsubscribe = listenToChatMessages(selectedChat.id, (msgs) => {
      setMessages(msgs);
      // Mark chat as read
      if (currentUser) {
        markChatAsRead(selectedChat.id, currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [selectedChat, currentUser]);

  // Auto scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to Notifications
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToNotifications(currentUser.uid, (notifs) => {
      setNotifications(notifs);
      setNotifCount(notifs.filter(n => !n.read).length);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listen to incoming and active calls for the current user
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToActiveCalls(currentUser.uid, (calls) => {
      // Find call ringing for me
      const ringing = calls.find(c => c.receiverId === currentUser.uid && c.status === 'ringing');
      setIncomingCall(ringing || null);

      // Find an accepted call I am in
      const accepted = calls.find(c => (c.receiverId === currentUser.uid || c.callerId === currentUser.uid) && c.status === 'accepted');
      if (accepted) {
        setActiveCall(accepted);
        setOutgoingCall(null);
        setIncomingCall(null);
      } else {
        setActiveCall(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Get available people to message
  useEffect(() => {
    if (!currentUser) return;
    getAllCreators(currentUser.uid).then(setAvailableCreators);
  }, [currentUser, showStartChat]);

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !currentUserProfile || !selectedChat) return;
    const otherParticipantId = selectedChat.participants.find(p => p !== currentUser.uid) || '';
    
    try {
      const callId = await createCallDoc(
        currentUser.uid,
        otherParticipantId,
        currentUserProfile.displayName || currentUserProfile.username,
        currentUserProfile.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.uid}`,
        type
      );

      const outgoing = {
        id: callId,
        callerId: currentUser.uid,
        receiverId: otherParticipantId,
        callerName: currentUserProfile.displayName || currentUserProfile.username,
        callerAvatar: currentUserProfile.photoURL,
        type,
        status: 'ringing'
      };
      setOutgoingCall(outgoing);

      // Listen to specific call status
      const unsubCall = listenToSpecificCall(callId, (call) => {
        if (!call) {
          setOutgoingCall(null);
          return;
        }
        if (call.status === 'accepted') {
          setActiveCall(call);
          setOutgoingCall(null);
          unsubCall();
        } else if (call.status === 'declined' || call.status === 'ended') {
          setOutgoingCall(null);
          unsubCall();
        }
      });
    } catch (err) {
      console.error("Error starting call:", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("La taille du fichier ne doit pas dépasser 2 Mo pour un envoi fluide.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      let type: 'image' | 'video' | 'audio' = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      setAttachment({
        dataUrl: reader.result as string,
        type,
        name: file.name
      });
      setIsUploading(false);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !attachment) || !selectedChat || !currentUser) return;

    const otherParticipantId = selectedChat.participants.find(p => p !== currentUser.uid) || '';
    const text = messageInput.trim();
    const mediaUrl = attachment?.dataUrl;
    const mediaType = attachment?.type;

    setMessageInput('');
    setAttachment(null);
    
    try {
      await sendDirectMessage(selectedChat.id, currentUser.uid, otherParticipantId, text, mediaUrl, mediaType);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleStartChatWithCreator = async (creator: UserProfile) => {
    if (!currentUser) return;
    setCheckingMutual(creator.id);
    
    try {
      const isMutual = await checkMutualFollow(currentUser.uid, creator.id);
      
      if (!isMutual) {
        const confirmStart = window.confirm(
          `La messagerie privée est réservée aux abonnés mutuels (échanges entre abonnés). Vous ne vous suivez pas mutuellement avec @${creator.username}. Souhaitez-vous quand même lui envoyer un message ?`
        );
        if (!confirmStart) {
          setCheckingMutual(null);
          return;
        }
      }

      const chatId = await createOrGetChat(currentUser.uid, creator.id);
      const chatObj: Chat = {
        id: chatId,
        participants: [currentUser.uid, creator.id],
        lastMessage: '',
        lastMessageSenderId: currentUser.uid,
        lastMessageAt: new Date().toISOString(),
        unreadBy: [],
        otherUser: creator
      };
      setSelectedChat(chatObj);
      setShowStartChat(false);
    } catch (err) {
      console.error("Error creating chat:", err);
    } finally {
      setCheckingMutual(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MessageSquare size={48} className="text-zinc-600 mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-white">Connexion requise</h3>
        <p className="text-zinc-400 text-sm max-w-xs mt-1">Connectez-vous via Google pour accéder à votre messagerie et à vos notifications.</p>
        <button 
          onClick={onRequireAuth}
          className="mt-6 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#121212] flex flex-col overflow-hidden text-white relative">
      
      {/* FLOATING INCOMING CALL NOTIFICATION AT THE TOP */}
      {incomingCall && (
        <div className="absolute top-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md p-4 rounded-2xl border border-rose-500/35 shadow-2xl z-50 flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-3 text-left">
            <div className="relative shrink-0">
              <img 
                src={incomingCall.callerAvatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${incomingCall.callerId}`} 
                className="w-10 h-10 rounded-full object-cover border-2 border-rose-500" 
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-white truncate">@{incomingCall.callerName}</p>
              <p className="text-xs text-zinc-400">Appel {incomingCall.type === 'video' ? 'vidéo' : 'audio'} entrant...</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={async () => {
                await updateCallStatus(incomingCall.id, 'accepted');
              }}
              className="w-9 h-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors shrink-0"
              title="Accepter"
            >
              <Check size={18} />
            </button>
            <button
              onClick={async () => {
                await updateCallStatus(incomingCall.id, 'declined');
              }}
              className="w-9 h-9 flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-colors shrink-0"
              title="Décliner"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* OUTGOING CALL RINGING OVERLAY */}
      {outgoingCall && (
        <div className="absolute inset-0 bg-zinc-950/95 z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center scale-105 animate-pulse">
              <PhoneCall size={36} className="text-rose-400 animate-bounce" />
            </div>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border border-zinc-950 flex items-center justify-center animate-ping text-[10px] text-white"></span>
          </div>
          <h3 className="text-lg font-black uppercase tracking-wider">Appel en cours...</h3>
          <p className="text-sm text-zinc-400 mt-1">Connexion avec @{selectedChat?.otherUser?.username || 'correspondant'}...</p>
          <span className="text-xs text-zinc-500 mt-2 bg-zinc-900 px-3 py-1 rounded-full uppercase tracking-widest text-[9px] border border-zinc-850">
            Appel {outgoingCall.type === 'video' ? 'Vidéo' : 'Audio'}
          </span>
          
          <button
            onClick={async () => {
              await updateCallStatus(outgoingCall.id, 'ended');
              setOutgoingCall(null);
            }}
            className="mt-12 w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      )}

      {/* ACTIVE CALL PANEL SCREEN */}
      {activeCall && (
        <div className="absolute inset-0 bg-zinc-950/98 z-50 flex flex-col justify-between p-6 text-white">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full animate-pulse">
              🟢 En communication
            </span>
            <span className="text-xs text-zinc-400 font-mono">Appel {activeCall.type === 'video' ? 'Vidéo' : 'Audio'}</span>
          </div>

          {/* Call Body */}
          <div className="flex-1 flex flex-col items-center justify-center my-6 relative min-h-0">
            {activeCall.type === 'video' ? (
              /* Dual split-screen video display */
              <div className="w-full h-full max-h-[380px] grid grid-rows-2 gap-3.5 rounded-2xl overflow-hidden">
                {/* Correspondent screen */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative flex items-center justify-center">
                  {isVideoOff ? (
                    <div className="text-center p-4">
                      <Camera size={24} className="text-zinc-600 mx-auto mb-1.5" />
                      <p className="text-[10px] text-zinc-500">Caméra désactivée</p>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-rose-950/35 to-cyan-950/35">
                      <img 
                        src={selectedChat?.otherUser?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedChat?.id}`} 
                        className="w-14 h-14 rounded-full border border-zinc-850 object-cover mb-2" 
                      />
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <span className="w-1.5 h-6 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        <span className="w-1.5 h-4 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-bold">
                    @{selectedChat?.otherUser?.username || 'correspondant'}
                  </span>
                </div>

                {/* My stream screen */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative flex items-center justify-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-zinc-900 to-zinc-850">
                    <img 
                      src={currentUserProfile?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.uid}`} 
                      className="w-14 h-14 rounded-full border border-zinc-850 object-cover mb-2" 
                    />
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      <span className="w-1.5 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </div>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-bold">
                    Vous
                  </span>
                </div>
              </div>
            ) : (
              /* Audio call with ambient audio soundwave */
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full border-4 border-rose-500 bg-rose-500/10 flex items-center justify-center scale-105 animate-pulse">
                    <img 
                      src={selectedChat?.otherUser?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedChat?.id}`} 
                      className="w-24 h-24 rounded-full object-cover" 
                    />
                  </div>
                  <span className="absolute -bottom-2 -right-2 bg-rose-500 p-2 rounded-full shadow-lg">
                    <Mic size={16} />
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-black">@{selectedChat?.otherUser?.username || 'correspondant'}</h4>
                  <p className="text-xs text-zinc-400 mt-1">Appel audio en cours...</p>
                </div>
                <div className="flex items-center gap-1.5 h-10 px-4 py-2 bg-zinc-900/60 rounded-xl border border-zinc-850">
                  <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-1 h-6 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  <span className="w-1 h-8 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  <span className="w-1 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                  <span className="w-1 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }} />
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 pb-4">
            <button
              onClick={() => setIsCallMuted(!isCallMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isCallMuted ? 'bg-rose-500 text-white' : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300'
              }`}
              title={isCallMuted ? "Réactiver micro" : "Couper micro"}
            >
              <Mic size={18} className={isCallMuted ? "stroke-[2.5px] text-white" : ""} />
            </button>

            <button
              onClick={async () => {
                await updateCallStatus(activeCall.id, 'ended');
                setActiveCall(null);
              }}
              className="w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95"
              title="Raccrocher"
            >
              <PhoneOff size={22} />
            </button>

            {activeCall.type === 'video' && (
              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isVideoOff ? 'bg-rose-500 text-white' : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300'
                }`}
                title={isVideoOff ? "Activer caméra" : "Désactiver caméra"}
              >
                <Camera size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {selectedChat ? (
        // ACTIVE CONVERSATION SCREEN
        <div className="flex-1 flex flex-col h-full bg-zinc-950" id="chat-conversation-container">
          {/* Header */}
          <div className="px-4 py-3 bg-[#121212] border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedChat(null)}
                className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div 
                onClick={() => {
                  if (selectedChat.otherUser) {
                    onSelectCreator(selectedChat.otherUser.id);
                  }
                }}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <img 
                  src={selectedChat.otherUser?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedChat.id}`} 
                  alt="Avatar" 
                  className="w-9 h-9 rounded-full object-cover border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left">
                  <h4 className="text-sm font-bold leading-tight">@{selectedChat.otherUser?.username || 'user'}</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Abonné
                  </span>
                </div>
              </div>
            </div>

            {/* Calling Action Buttons inside conversation header */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleStartCall('audio')}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all active:scale-90"
                title="Lancer un appel audio"
              >
                <Phone size={17} />
              </button>
              <button
                onClick={() => handleStartCall('video')}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all active:scale-90"
                title="Lancer un appel vidéo"
              >
                <Video size={17} />
              </button>
            </div>
          </div>

          {/* Message History */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <MessageSquare size={36} className="text-zinc-600 mb-2" />
                <p className="text-xs">Aucun message pour le moment.</p>
                <p className="text-[10px] mt-1">Dites bonjour à @{selectedChat.otherUser?.username} !</p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const isMe = msg.senderId === currentUser.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-left shadow-md relative ${
                      isMe 
                        ? 'bg-rose-500 text-white rounded-br-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                    }`}>
                      {/* Media image attachment */}
                      {msg.mediaUrl && msg.mediaType === 'image' && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10 shadow-inner max-w-full">
                          <img 
                            src={msg.mediaUrl} 
                            alt="Media attachment" 
                            className="max-h-[160px] w-full object-cover cursor-pointer hover:scale-[1.02] transition-transform" 
                          />
                        </div>
                      )}
                      
                      {/* Media video attachment */}
                      {msg.mediaUrl && msg.mediaType === 'video' && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-white/10 shadow-inner bg-black max-w-full">
                          <video src={msg.mediaUrl} controls className="w-full max-h-[160px] object-contain" />
                        </div>
                      )}
                      
                      {/* Media audio attachment */}
                      {msg.mediaUrl && msg.mediaType === 'audio' && (
                        <div className="mb-2 flex items-center gap-1.5 py-1 max-w-full">
                          <audio src={msg.mediaUrl} controls className="w-full max-w-[190px] h-8 filter invert shrink-0" />
                        </div>
                      )}

                      {msg.text && <p className="break-words font-medium">{msg.text}</p>}
                      <span className={`block text-[8px] text-right mt-1 opacity-70 font-mono`}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ATTACHMENT PREVIEW DRAWER */}
          {attachment && (
            <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-850 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {attachment.type === 'image' && (
                  <img src={attachment.dataUrl} className="w-8 h-8 rounded object-cover border border-zinc-800" />
                )}
                {attachment.type === 'video' && (
                  <div className="w-8 h-8 bg-black flex items-center justify-center rounded border border-zinc-850">
                    <Video size={14} className="text-rose-400" />
                  </div>
                )}
                {attachment.type === 'audio' && (
                  <div className="w-8 h-8 bg-black flex items-center justify-center rounded border border-zinc-850">
                    <Mic size={14} className="text-cyan-400" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-[10px] font-extrabold text-zinc-300 truncate max-w-[180px]">{attachment.name}</p>
                  <p className="text-[8px] text-zinc-500 capitalize">{attachment.type} prêt à être envoyé</p>
                </div>
              </div>
              <button
                onClick={() => setAttachment(null)}
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* DM Input Footer with Attachments icon */}
          <form 
            onSubmit={handleSendMessage} 
            className="p-4 bg-[#121212] border-t border-zinc-800 flex gap-2.5 items-center shrink-0"
          >
            {/* Hidden native input for multi-media file selector */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              accept="image/*,video/*,audio/*" 
            />

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-450 hover:text-white rounded-xl transition-all shrink-0 active:scale-95"
              title="Ajouter photo, vidéo ou audio"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <Paperclip size={16} />}
            </button>

            <input
              type="text"
              placeholder={attachment ? "Légende de l'envoi..." : "Écrire un message..."}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              id="dm-input-box"
            />
            
            <button
              type="submit"
              disabled={!messageInput.trim() && !attachment}
              className="p-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl disabled:opacity-50 transition-all shrink-0 active:scale-95"
              id="dm-send-btn"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        // MAIN INBOX CHATS & NOTIFICATION SELECTOR
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-zinc-800/80 bg-[#121212] flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight uppercase">Boîte de réception</h2>
            {activeTab === 'notifications' && notifications.length > 0 && (
              <button 
                onClick={() => clearAllNotifications(currentUser.uid, notifications)}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <Trash2 size={14} /> Tout effacer
              </button>
            )}
          </div>

          {/* Tab selectors */}
          <div className="flex border-b border-zinc-800 bg-[#121212] px-2 shrink-0">
            <button
              onClick={() => { setActiveTab('messages'); setShowStartChat(false); }}
              className={`flex-1 py-3.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'messages' && !showStartChat
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
              id="tab-messages-btn"
            >
              <MessageSquare size={16} />
              Messages
              {chats.some(c => c.unreadBy.includes(currentUser.uid)) && (
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
              )}
            </button>
            
            <button
              onClick={() => { setActiveTab('notifications'); setShowStartChat(false); }}
              className={`flex-1 py-3.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'notifications'
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
              id="tab-notifications-btn"
            >
              <Bell size={16} />
              Notifications
              {notifCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                  {notifCount}
                </span>
              )}
            </button>
          </div>

          {/* Inner content view */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'messages' ? (
              // VIEW: CHAT CONVERSATION LIST
              <div className="divide-y divide-zinc-800/40" id="chats-conversations-list">
                
                {/* Custom CTA to start a new direct chat */}
                <div className="p-4 bg-zinc-900/10 text-center shrink-0">
                  <button
                    onClick={() => setShowStartChat(!showStartChat)}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white border border-zinc-800 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={13} className="text-rose-500 animate-pulse" />
                    {showStartChat ? "Retour aux discussions" : "Discuter avec un Créateur"}
                  </button>
                </div>

                {showStartChat ? (
                  // SELECT USER TO START CONVERSATION
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] uppercase font-black tracking-wider text-zinc-500 p-2 text-left">Créateurs disponibles</p>
                    {availableCreators.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-8">Aucun autre créateur disponible pour le moment.</p>
                    ) : (
                      availableCreators.map((creator) => (
                        <div
                          key={creator.id}
                          onClick={() => handleStartChatWithCreator(creator)}
                          className="p-3 flex items-center justify-between hover:bg-zinc-900/60 rounded-xl cursor-pointer transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <img src={creator.photoURL} className="w-9 h-9 rounded-full object-cover border border-zinc-800" />
                            <div>
                              <h4 className="text-xs font-black text-white">@{creator.username}</h4>
                              <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">{creator.bio || "Aucun bio"}</p>
                            </div>
                          </div>
                          <button
                            disabled={checkingMutual === creator.id}
                            className="px-3 py-1.5 bg-rose-500 text-[10px] font-extrabold uppercase rounded-lg text-white"
                          >
                            {checkingMutual === creator.id ? "..." : "Message"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <MessageSquare size={44} className="text-zinc-600 mb-3" />
                    <p className="text-sm font-bold text-zinc-400">Aucune discussion</p>
                    <p className="text-xs mt-1">Commencez à échanger avec vos abonnés mutuels !</p>
                  </div>
                ) : (
                  chats.map((chat) => {
                    const hasUnread = chat.unreadBy.includes(currentUser.uid);
                    return (
                      <div 
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={`p-4 flex items-center justify-between gap-3 hover:bg-zinc-900 cursor-pointer transition-colors text-left ${
                          hasUnread ? 'bg-rose-500/5' : ''
                        }`}
                        id={`chat-item-${chat.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img 
                            src={chat.otherUser?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${chat.id}`} 
                            alt="Avatar" 
                            className="w-11 h-11 rounded-full object-cover border border-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <h4 className={`text-sm ${hasUnread ? 'font-black text-white' : 'font-bold text-zinc-300'}`}>
                              @{chat.otherUser?.username || 'user'}
                            </h4>
                            <p className={`text-xs truncate mt-0.5 ${hasUnread ? 'text-zinc-100 font-semibold' : 'text-zinc-500'}`}>
                              {chat.lastMessageSenderId === currentUser.uid ? 'Vous : ' : ''}
                              {chat.lastMessage}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[9px] text-zinc-600">
                            {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleDateString('fr-FR', {
                              month: 'short',
                              day: 'numeric'
                            }) : ''}
                          </span>
                          {hasUnread && (
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              // VIEW: NOTIFICATIONS LIST
              <div className="divide-y divide-zinc-800/60" id="notifications-list">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <Bell size={44} className="text-zinc-600 mb-3" />
                    <p className="text-sm font-bold text-zinc-400">Aucune notification</p>
                    <p className="text-xs mt-1">Vous serez alerté dès que la communauté interagit avec vous !</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const iconMap = {
                      like: <Heart size={14} className="text-rose-500 fill-rose-500" />,
                      comment: <MessageCircle size={14} className="text-blue-400" />,
                      follow: <UserPlus size={14} className="text-emerald-400" />,
                      message: <MessageSquare size={14} className="text-purple-400" />
                    };
                    return (
                      <div 
                        key={notif.id}
                        onClick={async () => {
                          if (!notif.read) {
                            await markNotificationAsRead(currentUser.uid, notif.id);
                          }
                          if (onNotificationAction) {
                            if (notif.type === 'like' || notif.type === 'comment') {
                              onNotificationAction('video', notif.targetId);
                            } else if (notif.type === 'follow') {
                              onNotificationAction('profile', notif.senderId);
                            }
                          }
                        }}
                        className={`p-4 flex items-start gap-3 hover:bg-zinc-900 transition-all text-left ${
                          !notif.read ? 'bg-zinc-900/60 font-semibold border-l-2 border-rose-500' : ''
                        }`}
                        id={`notif-item-${notif.id}`}
                      >
                        <img 
                          src={notif.senderAvatar} 
                          alt={notif.senderName} 
                          className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-white">@{notif.senderName}</span>
                            <span className="text-[10px] text-zinc-500">
                              {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('fr-FR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1 flex items-center gap-1.5">
                            <span className="shrink-0">{iconMap[notif.type]}</span>
                            <span className="truncate">{notif.text}</span>
                          </p>
                        </div>

                        {!notif.read && (
                          <span className="w-2 h-2 bg-rose-500 rounded-full shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
