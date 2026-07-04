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
  Users
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
  checkMutualFollow
} from '../dbUtils';
import { Chat, Message, Notification, UserProfile } from '../types';

interface InboxViewProps {
  currentUser: User | null;
  currentUserProfile: UserProfile | null;
  onRequireAuth: () => void;
  onSelectCreator: (creatorId: string) => void;
}

export default function InboxView({ currentUser, currentUserProfile, onRequireAuth, onSelectCreator }: InboxViewProps) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Get available people to message
  useEffect(() => {
    if (!currentUser) return;
    getAllCreators(currentUser.uid).then(setAvailableCreators);
  }, [currentUser, showStartChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChat || !currentUser) return;

    const otherParticipantId = selectedChat.participants.find(p => p !== currentUser.uid) || '';
    const text = messageInput.trim();
    setMessageInput('');
    
    try {
      await sendDirectMessage(selectedChat.id, currentUser.uid, otherParticipantId, text);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleStartChatWithCreator = async (creator: UserProfile) => {
    if (!currentUser) return;
    setCheckingMutual(creator.id);
    
    try {
      // Check if they are subscribers/followers (or mutual)
      const isMutual = await checkMutualFollow(currentUser.uid, creator.id);
      
      // Let's allow messaging if there's mutual, or provide a warning but allow for demo/testing purposes
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
    <div className="w-full h-full bg-[#121212] flex flex-col overflow-hidden text-white">
      {selectedChat ? (
        // ACTIVE CONVERSATION SCREEN
        <div className="flex-1 flex flex-col h-full bg-zinc-950" id="chat-conversation-container">
          {/* Header */}
          <div className="px-4 py-3 bg-[#121212] border-b border-zinc-800 flex items-center gap-3">
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

          {/* Message History */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <MessageSquare size={36} className="text-zinc-600 mb-2" />
                <p className="text-xs">Aucun message pour le moment.</p>
                <p className="text-[10px] mt-1">Dites bonjour à @{selectedChat.otherUser?.username} !</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUser.uid;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-left shadow-md ${
                      isMe 
                        ? 'bg-rose-500 text-white rounded-br-none' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                    }`}>
                      <p className="break-words">{msg.text}</p>
                      <span className={`block text-[9px] text-right mt-1 opacity-70`}>
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

          {/* DM Input Footer */}
          <form 
            onSubmit={handleSendMessage} 
            className="p-4 bg-[#121212] border-t border-zinc-800 flex gap-2.5 items-center"
          >
            <input
              type="text"
              placeholder="Écrire un message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              id="dm-input-box"
            />
            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="p-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl disabled:opacity-50 transition-colors"
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
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('notifications'); setShowStartChat(false); }}
              className={`flex-1 py-3.5 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'notifications'
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
              id="tab-notifs-btn"
            >
              <Bell size={16} />
              Notifications
              {notifCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black leading-none">
                  {notifCount}
                </span>
              )}
            </button>
          </div>

          {/* Content views */}
          <div className="flex-1 overflow-y-auto">
            {showStartChat ? (
              // SUB-VIEW: START A CONVERSATION
              <div className="p-4 space-y-4" id="start-chat-container">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} /> Démarrer un échange
                  </h3>
                  <button 
                    onClick={() => setShowStartChat(false)}
                    className="text-xs text-rose-500 font-bold hover:underline"
                  >
                    Retour
                  </button>
                </div>
                
                {availableCreators.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">Aucun membre disponible pour le moment.</p>
                ) : (
                  <div className="space-y-2">
                    {availableCreators.map((creator) => (
                      <div 
                        key={creator.id}
                        className="p-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl flex items-center justify-between gap-3 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={creator.photoURL} 
                            alt={creator.username} 
                            className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-white">@{creator.username}</h4>
                            <p className="text-xs text-zinc-400 line-clamp-1">{creator.displayName}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartChatWithCreator(creator)}
                          disabled={checkingMutual === creator.id}
                          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-zinc-800 text-white disabled:text-zinc-500 text-xs font-bold rounded-lg transition-colors shrink-0"
                        >
                          {checkingMutual === creator.id ? "Validation..." : "Discuter"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'messages' ? (
              // VIEW: PRIVATE MESSAGES CHAT LIST
              <div className="divide-y divide-zinc-800/60" id="chats-list">
                {/* Float button to start conversation */}
                <div className="p-4 flex justify-end shrink-0">
                  <button
                    onClick={() => setShowStartChat(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                    id="new-chat-launcher"
                  >
                    <UserPlus size={14} /> Nouveau message
                  </button>
                </div>

                {chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500 px-6">
                    <MessageSquare size={44} className="text-zinc-600 mb-3" />
                    <p className="text-sm font-bold text-zinc-400">Aucun message</p>
                    <p className="text-xs text-center mt-1 max-w-xs">
                      Vos échanges privés avec d'autres abonnés apparaîtront ici. Cliquez sur "Nouveau message" pour commencer !
                    </p>
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
                        onClick={() => {
                          if (!notif.read) {
                            markNotificationAsRead(currentUser.uid, notif.id);
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
