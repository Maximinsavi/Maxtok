import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Video, Film, Sparkles, AlertCircle, Upload, Link, FileVideo, Info } from 'lucide-react';
import { uploadCustomVideo, saveVideoToLocalDB } from '../dbUtils';
import { User } from 'firebase/auth';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUploadSuccess: () => void;
}

const TEMPLATE_VIDEOS = [
  { name: "🌆 Cyberpunk Ville", url: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lit-city-street-looking-around-42217-large.mp4", category: "tech", song: "SynthWave - Neon City Beats" },
  { name: "🌊 Sunset Beach", url: "https://assets.mixkit.co/videos/preview/mixkit-waves-breaking-on-sandy-beach-42125-large.mp4", category: "nature", song: "Sunsets - Coastal Vibe" },
  { name: "🛹 Skater tricks", url: "https://assets.mixkit.co/videos/preview/mixkit-skater-doing-tricks-on-a-rail-42023-large.mp4", category: "sports", song: "Skate Or Die - Garage Band" },
  { name: "🍔 Gourmet Burger", url: "https://assets.mixkit.co/videos/preview/mixkit-delicious-looking-burger-and-fries-42091-large.mp4", category: "food", song: "Lo-Fi Cooking Sessions" },
  { name: "🎧 DJ Hands", url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-42100-large.mp4", category: "music", song: "DJ Live Set - Club Anthem" }
];

export default function UploadModal({ isOpen, onClose, currentUser, onUploadSuccess }: UploadModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('comedy');
  const [songName, setSongName] = useState('Son original');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Choose source states
  const [uploadSource, setUploadSource] = useState<'gallery' | 'url'>('gallery');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; isLocalBlob: boolean } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileError('');

    const sizeInMB = file.size / (1024 * 1024);
    setSelectedFile(file);

    // If file size is under 750 KB, we store it persistently as Base64 in Firestore.
    // 750 KB Base64 string is around 1 MB, which is the Firestore document limit.
    if (file.size <= 768000) { 
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setVideoUrl(reader.result);
          setFileInfo({
            name: file.name,
            size: `${sizeInMB.toFixed(2)} Mo`,
            isLocalBlob: false
          });
        }
      };
      reader.onerror = () => {
        setFileError("Erreur lors de la lecture du fichier local.");
      };
      reader.readAsDataURL(file);
    } else {
      // Over 750 KB: Store locally inside IndexedDB upon clicking Publish.
      // We generate a unique ID string.
      const uniqueId = 'local_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setVideoUrl('idb://' + uniqueId);
      setFileInfo({
        name: file.name,
        size: `${sizeInMB.toFixed(2)} Mo`,
        isLocalBlob: true
      });
    }
  };

  const handleSelectTemplate = (tpl: typeof TEMPLATE_VIDEOS[0]) => {
    setVideoUrl(tpl.url);
    setCategory(tpl.category);
    setSongName(tpl.song);
    setUploadSource('url'); // Switch to URL source when a template is selected
    setFileInfo(null);
    setSelectedFile(null);
    setError('');
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) {
      setError("Vous devez être connecté pour publier une vidéo.");
      return;
    }

    if (!videoUrl.trim()) {
      setError(uploadSource === 'gallery' ? "Veuillez choisir un fichier vidéo depuis votre galerie." : "Le lien de la vidéo est requis.");
      return;
    }

    if (uploadSource === 'url' && !videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      setError("Le lien de la vidéo doit être une URL valide (HTTP/HTTPS).");
      return;
    }

    if (!description.trim()) {
      setError("Une description ou légende est requise.");
      return;
    }

    setIsUploading(true);
    try {
      if (selectedFile && videoUrl.startsWith('idb://')) {
        const localId = videoUrl.substring(6);
        await saveVideoToLocalDB(localId, selectedFile);
      }

      await uploadCustomVideo({
        videoUrl: videoUrl.trim(),
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName || 'user_' + currentUser.uid.substring(0, 5),
        creatorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.uid}`,
        description: description.trim(),
        category,
        songName: songName.trim() || 'Son original'
      });
      onUploadSuccess();
      onClose();
    } catch (err) {
      console.error("Error publishing video:", err);
      setError("Une erreur s'est produite lors de la publication. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-lg p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
        id="upload-modal-container"
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors disabled:opacity-50"
          id="upload-close-btn"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-rose-500/10 rounded-xl">
            <Film className="text-rose-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Publier une vidéo</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Partagez vos moments mémorables avec la communauté</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handlePublish} className="space-y-5 text-left">
          {/* Quick template selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
              🚀 Raccourci : Choisir un modèle de vidéo de stock
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VIDEOS.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-colors border border-zinc-700/50"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/50">
            <button
              type="button"
              onClick={() => {
                setUploadSource('gallery');
                setVideoUrl(selectedFile ? videoUrl : '');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                uploadSource === 'gallery' 
                  ? 'bg-rose-500 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload size={14} />
              Galerie locale
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadSource('url');
                if (videoUrl.startsWith('data:') || videoUrl.startsWith('blob:')) {
                  setVideoUrl('');
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                uploadSource === 'url' 
                  ? 'bg-rose-500 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Link size={14} />
              Lien Web (URL)
            </button>
          </div>

          {/* Video Input source */}
          {uploadSource === 'gallery' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Sélectionner une vidéo depuis votre galerie
              </label>
              
              <div className="relative group border-2 border-dashed border-zinc-700 hover:border-rose-500/50 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-xl p-6 transition-all duration-200 text-center cursor-pointer">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full group-hover:scale-110 transition-transform duration-200">
                    <FileVideo size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">
                      {fileInfo ? "Changer de vidéo" : "Cliquez ou glissez une vidéo ici"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 font-medium">
                      Formats vidéo acceptés (MP4, WebM, etc.) &bull; Sans limite de Mo
                    </p>
                  </div>
                </div>
              </div>

              {fileError && (
                <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                  <AlertCircle size={12} className="shrink-0" /> {fileError}
                </p>
              )}

              {fileInfo && (
                <div className="p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="font-semibold truncate max-w-[70%]" title={fileInfo.name}>
                      📁 {fileInfo.name}
                    </span>
                    <span className="px-2 py-0.5 bg-zinc-700 rounded text-[10px] text-zinc-400 font-mono">
                      {fileInfo.size}
                    </span>
                  </div>
                  
                  {fileInfo.isLocalBlob ? (
                    <div className="flex items-start gap-1.5 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[11px] leading-relaxed">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Vidéo haute capacité (&gt; 750 Ko) :</strong> Cette vidéo est sauvegardée de manière permanente dans la base de données locale rapide (IndexedDB) de votre navigateur. Elle sera jouée de manière fluide avec audio et sans aucune limite de taille !
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[11px] leading-relaxed">
                      <Sparkles size={14} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Vidéo optimisée (&lt; 750 Ko) :</strong> Parfait ! Cette vidéo sera entièrement sauvegardée dans la base de données Firestore et sera visible par tous les utilisateurs.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Lien de la vidéo (MP4)
              </label>
              <input
                type="url"
                required={uploadSource === 'url'}
                placeholder="https://exemple.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isUploading}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50"
                id="upload-video-url-input"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Entrez l'adresse directe d'un fichier .mp4 hébergé sur le web.
              </span>
            </div>
          )}

          {/* Description / Caption */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Légende / Description
            </label>
            <textarea
              required
              rows={3}
              placeholder="Racontez-nous quelque chose d'intéressant... #fun #challenge"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 disabled:opacity-50"
              id="upload-desc-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isUploading}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                id="upload-category-select"
              >
                <option value="comedy">Humour</option>
                <option value="tech">Technologie</option>
                <option value="music">Musique</option>
                <option value="sports">Sports</option>
                <option value="food">Cuisine & Food</option>
                <option value="nature">Nature & Voyage</option>
              </select>
            </div>

            {/* Song Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Nom de la piste audio
              </label>
              <input
                type="text"
                placeholder="Son original - @username"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                disabled={isUploading}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                id="upload-song-input"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-colors disabled:opacity-50"
              id="upload-cancel-btn"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:hover:bg-rose-500"
              id="upload-submit-btn"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Publication...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Publier
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
