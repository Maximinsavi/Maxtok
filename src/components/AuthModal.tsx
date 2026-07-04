import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { createOrUpdateUser } from '../dbUtils';
import { motion } from 'motion/react';
import { LogIn, Sparkles, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await createOrUpdateUser({
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL
        });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      alert("La connexion a échoué. Veuillez réessayer.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        id="auth-modal-container"
      >
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/20 blur-[100px] pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          id="auth-close-btn"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-8">
          <div className="flex items-center justify-center w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-full mb-4">
            <Sparkles className="text-rose-500" size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Rejoignez TikTok Clone</h2>
          <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
            Connectez-vous pour aimer les vidéos, ajouter des commentaires, suivre vos créateurs préférés et échanger en privé.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center w-full gap-3 py-3.5 px-4 bg-white hover:bg-zinc-100 text-zinc-950 font-semibold rounded-xl shadow-md active:scale-[0.98] transition-all"
            id="google-signin-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continuer avec Google
          </button>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-full gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium rounded-xl transition-colors"
            id="guest-continue-btn"
          >
            Continuer en mode invité
          </button>
        </div>

        {/* Footer info (Data Protection warning) */}
        <div className="mt-8 text-center border-t border-zinc-800 pt-4">
          <p className="text-[11px] text-zinc-500 leading-normal">
            Vos données personnelles sont stockées de manière sécurisée sur Firebase. Nous respectons votre vie privée et ne partageons aucune information personnelle.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
