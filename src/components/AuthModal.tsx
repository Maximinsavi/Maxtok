import React, { useState } from 'react';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { createOrUpdateUser } from '../dbUtils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Mail, 
  Lock, 
  User as UserIcon, 
  AtSign, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  AlertCircle 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  
  // Custom states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const getFriendlyErrorMessage = (errCode: string): string => {
    switch (errCode) {
      case 'auth/invalid-email':
        return "L'adresse e-mail n'est pas valide.";
      case 'auth/user-disabled':
        return "Ce compte utilisateur a été désactivé.";
      case 'auth/user-not-found':
        return "Aucun compte trouvé avec cette adresse e-mail.";
      case 'auth/wrong-password':
        return "Mot de passe incorrect. Veuillez réessayer.";
      case 'auth/email-already-in-use':
        return "Cette adresse e-mail est déjà associée à un compte existant.";
      case 'auth/weak-password':
        return "Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.";
      case 'auth/invalid-credential':
        return "Identifiants incorrects ou invalides.";
      case 'auth/missing-password':
        return "Le mot de passe est requis.";
      default:
        return "Une erreur s'est produite. Veuillez réessayer.";
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
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
    } catch (err: any) {
      console.error("Error signing in with Google:", err);
      setError(getFriendlyErrorMessage(err.code || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedDisplayName = displayName.trim();
    const cleanUsername = username.trim().replace(/\s+/g, '_').toLowerCase();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Veuillez remplir tous les champs obligatoires.");
      setIsLoading(false);
      return;
    }

    if (activeTab === 'signup') {
      if (!trimmedDisplayName) {
        setError("Veuillez saisir votre nom d'affichage.");
        setIsLoading(false);
        return;
      }
      if (!cleanUsername) {
        setError("Veuillez saisir votre nom d'utilisateur unique.");
        setIsLoading(false);
        return;
      }
    }

    try {
      if (activeTab === 'login') {
        // Handle Email/Password Login
        const result = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        if (result.user) {
          // Simply sync database user profile
          await createOrUpdateUser({
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL
          });
          if (onSuccess) onSuccess();
          onClose();
        }
      } else {
        // Handle Email/Password Signup
        const result = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        if (result.user) {
          // Update Firebase profile display name
          await updateProfile(result.user, {
            displayName: trimmedDisplayName,
            photoURL: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${result.user.uid}`
          });

          // Store standard user profile in Firestore database
          await createOrUpdateUser({
            uid: result.user.uid,
            displayName: trimmedDisplayName,
            email: trimmedEmail,
            photoURL: result.user.photoURL,
            username: cleanUsername
          });

          if (onSuccess) onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(getFriendlyErrorMessage(err.code || ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        id="auth-modal-container"
      >
        {/* Neon accent glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-[100px] pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors z-10"
          id="auth-close-btn"
          disabled={isLoading}
        >
          <X size={18} />
        </button>

        {/* Scrollable Container */}
        <div className="p-6 md:p-8 overflow-y-auto w-full">
          {/* Header Branding */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-full mb-3">
              <Sparkles className="text-rose-500 animate-pulse" size={24} />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              {activeTab === 'login' ? 'Connexion' : 'Créer un compte'}
            </h2>
            <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed max-w-[280px]">
              {activeTab === 'login' 
                ? 'Connectez-vous pour interagir avec notre communauté.' 
                : 'Créez votre profil en quelques instants pour rejoindre l\'aventure.'}
            </p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-6">
            <button
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                activeTab === 'login' 
                  ? 'bg-rose-500 text-white shadow' 
                  : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-50'
              }`}
            >
              <LogIn size={13} />
              Se connecter
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setError('');
              }}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                activeTab === 'signup' 
                  ? 'bg-rose-500 text-white shadow' 
                  : 'text-zinc-400 hover:text-zinc-200 disabled:opacity-50'
              }`}
            >
              <UserPlus size={13} />
              Créer un compte
            </button>
          </div>

          {/* Friendly Validation Errors */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-start gap-2 mb-5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Display Name Input (Only on Signup) */}
            {activeTab === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  Nom d'affichage
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Maxime Dupont"
                    disabled={isLoading}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50 transition-all"
                  />
                  <UserIcon size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
                </div>
              </div>
            )}

            {/* Handle/Username Input (Only on Signup) */}
            {activeTab === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  Nom d'utilisateur (sans espaces)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="maxime_dupont"
                    disabled={isLoading}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50 transition-all font-mono"
                  />
                  <AtSign size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                Adresse e-mail
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  disabled={isLoading}
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50 transition-all"
                />
                <Mail size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  disabled={isLoading}
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-9 pr-10 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50 transition-all"
                />
                <Lock size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              id="auth-submit-btn"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : activeTab === 'login' ? (
                <>
                  <LogIn size={14} />
                  Se connecter
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  S'enregistrer
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-zinc-800/60"></div>
            <span className="flex-shrink mx-4 text-[10px] text-zinc-600 uppercase font-black tracking-widest">Ou</span>
            <div className="flex-grow border-t border-zinc-800/60"></div>
          </div>

          {/* Social Sign-In Methods */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex items-center justify-center w-full gap-2.5 py-3.5 px-4 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow active:scale-[0.98] transition-all disabled:opacity-50"
              id="google-signin-btn"
            >
              <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
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
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex items-center justify-center w-full gap-2 py-3 px-4 bg-zinc-800/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-zinc-800/50 disabled:opacity-50"
              id="guest-continue-btn"
            >
              Mode invité (Lecture seule)
            </button>
          </div>

          {/* Footer warning */}
          <div className="mt-6 text-center border-t border-zinc-800/60 pt-4">
            <p className="text-[10px] text-zinc-500 leading-normal">
              Vos informations de connexion sont protégées par Firebase Authentication. Vos données restent strictement confidentielles.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
