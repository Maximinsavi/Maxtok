import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles, X, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserPreferences } from '../dbUtils';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  onSaveSuccess: (updatedPrefs: string[]) => void;
}

const CATEGORY_TEMPLATES = [
  { id: 'comedy', name: 'Humour 🎭', description: 'Blagues, sketchs, vidéos drôles' },
  { id: 'tech', name: 'Technologie 💻', description: 'Gadgets, programmation, futur, IA' },
  { id: 'music', name: 'Musique 🎧', description: 'DJ, remixes, instruments, lofi' },
  { id: 'sports', name: 'Sports 🛹', description: 'Skate, glisse, entraînements' },
  { id: 'food', name: 'Cuisine & Food 🍔', description: 'Recettes délicieuses, street food' },
  { id: 'nature', name: 'Nature & Voyage 🌲', description: 'Grands espaces, paysages apaisants' }
];

export default function PreferencesModal({
  isOpen,
  onClose,
  currentUserProfile,
  onSaveSuccess
}: PreferencesModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUserProfile?.preferences) {
      setSelectedCategories(currentUserProfile.preferences);
    } else {
      setSelectedCategories(CATEGORY_TEMPLATES.map(c => c.id)); // Default select all
    }
  }, [currentUserProfile, isOpen]);

  if (!isOpen) return null;

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(catId)) {
        // Prevent clearing all categories
        if (prev.length <= 1) return prev;
        return prev.filter(c => c !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (currentUserProfile) {
        await updateUserPreferences(currentUserProfile.id, selectedCategories);
      }
      onSaveSuccess(selectedCategories);
      onClose();
    } catch (err) {
      console.error("Error saving preferences:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 text-left"
        id="preferences-modal"
      >
        {/* Decorative backdrop */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          id="pref-close-btn"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-rose-500/10 rounded-xl">
            <Sparkles className="text-rose-500" size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Filtrer vos préférences</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Personnalisez votre fil d'actualité vidéo "Pour toi"</p>
          </div>
        </div>

        {/* Info label */}
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Sélectionnez les catégories qui vous intéressent. Notre système de recommandation filtrera le flux principal pour n'afficher que le contenu qui correspond à vos choix.
        </p>

        {/* Categories grid */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {CATEGORY_TEMPLATES.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => handleToggleCategory(cat.id)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'bg-zinc-800/80 border-rose-500 text-white shadow-md'
                    : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-zinc-900/60'
                }`}
                id={`pref-cat-${cat.id}`}
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{cat.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected 
                    ? 'bg-rose-500 border-rose-500 text-white' 
                    : 'border-zinc-700 text-transparent'
                }`}>
                  <Check size={12} className="stroke-[3px]" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Save button and privacy safeguard */}
        <div className="mt-6 pt-4 border-t border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-950 p-2 rounded-lg border border-zinc-900">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Vos préférences sont stockées localement et cryptées sur Firestore.</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
              id="pref-save-btn"
            >
              {isSaving ? "Sauvegarde..." : "Appliquer les filtres"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
