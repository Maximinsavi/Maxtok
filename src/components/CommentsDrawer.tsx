import React, { useState, useEffect, useRef } from 'react';
import { listenToComments, addComment } from '../dbUtils';
import { Comment, Video } from '../types';
import { User } from 'firebase/auth';
import { X, Send, MessageSquareOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video;
  currentUser: User | null;
  onRequireAuth: () => void;
}

export default function CommentsDrawer({ isOpen, onClose, video, currentUser, onRequireAuth }: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Listen to comments on this video in real time
    const unsubscribe = listenToComments(video.id, (commentsList) => {
      setComments(commentsList);
    });

    return () => unsubscribe();
  }, [video.id, isOpen]);

  useEffect(() => {
    // Scroll to comments end when open
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, isOpen]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    if (!currentUser) {
      onRequireAuth();
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment(
        video,
        currentUser.uid,
        currentUser.displayName || 'user_' + currentUser.uid.substring(0, 5),
        currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.uid}`,
        newCommentText.trim()
      );
      setNewCommentText('');
    } catch (err) {
      console.error("Error posting comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/40">
      {/* Invisible backdrop to close by clicking above */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-h-[70%] bg-[#121212] border-t border-zinc-800 rounded-t-2xl flex flex-col overflow-hidden"
        id="comments-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">
            {comments.length} commentaires
          </span>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            id="comments-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <MessageSquareOff size={36} className="mb-2 text-zinc-600" />
              <p className="text-sm">Aucun commentaire pour le moment.</p>
              <p className="text-xs mt-1">Soyez le premier à donner votre avis !</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 text-left">
                <img 
                  src={comment.userAvatar} 
                  alt={comment.username}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-zinc-300">@{comment.username}</span>
                    <span className="text-[10px] text-zinc-500">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('fr-FR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-100 mt-1 break-words leading-relaxed">
                    {comment.text}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment input form */}
        <form 
          onSubmit={handleSubmitComment} 
          className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-2 items-center"
        >
          <input
            type="text"
            placeholder={currentUser ? "Ajouter un commentaire..." : "Connectez-vous pour commenter..."}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50"
            id="new-comment-input"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim() || isSubmitting}
            className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl disabled:opacity-50 disabled:hover:bg-rose-500 transition-colors shrink-0"
            id="comment-send-btn"
          >
            <Send size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
