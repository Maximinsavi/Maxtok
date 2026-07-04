import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  increment, 
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  or
} from 'firebase/firestore';
import { db } from './firebase';
import { Video, Comment, UserProfile, Follow, Chat, Message, Notification } from './types';

// Preset high quality stock videos for initial seeding
const PRESET_VIDEOS: Omit<Video, 'id' | 'createdAt'>[] = [
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lit-city-street-looking-around-42217-large.mp4',
    creatorId: 'neon_rider',
    creatorName: 'NeonRider',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    description: 'Neon dreams in the heart of Tokyo. Cyberpunk vibes are unmatched tonight! #tokyo #cyberpunk #neon #night',
    category: 'tech',
    songName: 'Lofi Cyberpunk - SynthWave Track',
    likesCount: 1542,
    commentsCount: 89,
    sharesCount: 322
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-mysterious-forest-with-light-beams-42171-large.mp4',
    creatorId: 'nature_explorer',
    creatorName: 'NatureGo',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    description: 'Chasing sunbeams in the deep mystical redwood forests. Nature never ceases to amaze me. 🌲✨ #nature #forest #peace #explore',
    category: 'nature',
    songName: 'Ambient Forest Flute - Nature Sounds',
    likesCount: 894,
    commentsCount: 34,
    sharesCount: 110
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-skater-doing-tricks-on-a-rail-42023-large.mp4',
    creatorId: 'shredder_sam',
    creatorName: 'SamSkates',
    creatorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    description: 'Nailing this clean rail slide on the third try today! Let\'s go! 🛹🔥 #skate #skateboard #fail #win #extreme',
    category: 'sports',
    songName: 'Punk Rock Anthems - Skate Vibes',
    likesCount: 2311,
    commentsCount: 154,
    sharesCount: 450
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-42100-large.mp4',
    creatorId: 'beat_master',
    creatorName: 'DJBeatDrop',
    creatorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    description: 'Mixing the new summer progressive house track. Turn up the bass! 🎧🔥 #dj #music #edm #remix #party',
    category: 'music',
    songName: 'Summer Rave 2026 - DJ BeatDrop',
    likesCount: 3120,
    commentsCount: 241,
    sharesCount: 812
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-delicious-looking-burger-and-fries-42091-large.mp4',
    creatorId: 'chef_sophie',
    creatorName: 'SophieBites',
    creatorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    description: 'Double cheese, toasted brioche, caramelized onions, and truffle fries. Pure heaven! 🍔🍟🤤 #food #foodie #burger #yummy',
    category: 'food',
    songName: 'Chill Jazz Hop - LoFi Beats',
    likesCount: 4320,
    commentsCount: 512,
    sharesCount: 1980
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-breaking-on-sandy-beach-42125-large.mp4',
    creatorId: 'ocean_breeze',
    creatorName: 'OceanVibes',
    creatorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    description: 'Just absolute therapeutic wave watching at sunset. Reset your mind. 🌊🌅 #ocean #beach #sunset #calm #lofi',
    category: 'nature',
    songName: 'Waves Crashing - Pure Healing Freqs',
    likesCount: 1205,
    commentsCount: 48,
    sharesCount: 195
  },
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-rotating-vinyl-record-on-a-player-42118-large.mp4',
    creatorId: 'vinyl_collector',
    creatorName: 'VintageGroove',
    creatorAvatar: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?auto=format&fit=crop&w=150&q=80',
    description: 'Spinning some classic 70s soul records this rainy afternoon. Vinyl just hits different. 🎶📻 #vinyl #vintage #retro #music #soul',
    category: 'music',
    songName: 'Retro Grooves - 1972 Master Remaster',
    likesCount: 1780,
    commentsCount: 96,
    sharesCount: 280
  }
];

// Helper to seed database if empty
export async function seedVideosIfEmpty() {
  try {
    const q = query(collection(db, 'videos'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("No videos found in Firestore. Seeding preset videos...");
      for (const preset of PRESET_VIDEOS) {
        const videoRef = doc(collection(db, 'videos'));
        const newVideo: Video = {
          ...preset,
          id: videoRef.id,
          createdAt: new Date().toISOString()
        };
        await setDoc(videoRef, newVideo);
        
        // Also seed the corresponding mock creators if they don\'t exist
        const creatorRef = doc(db, 'users', preset.creatorId);
        const creatorSnap = await getDoc(creatorRef);
        if (!creatorSnap.exists()) {
          const mockUser: UserProfile = {
            id: preset.creatorId,
            username: preset.creatorName.toLowerCase(),
            displayName: preset.creatorName,
            email: `${preset.creatorId}@example.com`,
            photoURL: preset.creatorAvatar,
            bio: `Official account of ${preset.creatorName}. Video creator.`,
            followersCount: Math.floor(Math.random() * 50000) + 2000,
            followingCount: Math.floor(Math.random() * 200),
            preferences: [preset.category],
            createdAt: new Date().toISOString()
          };
          await setDoc(creatorRef, mockUser);
        }
      }
      console.log("Seeding completed successfully.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// User Profile Operations
export async function createOrUpdateUser(user: { uid: string, displayName: string | null, email: string | null, photoURL: string | null, username?: string }) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const username = user.username || (user.displayName || 'user').replace(/\s+/g, '_').toLowerCase() + '_' + Math.floor(Math.random() * 1000);
      const newUser: UserProfile = {
        id: user.uid,
        username,
        displayName: user.displayName || 'Anonymous User',
        email: user.email || '',
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`,
        followersCount: 0,
        followingCount: 0,
        preferences: ['comedy', 'tech', 'music', 'sports', 'food', 'nature'],
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newUser);
      return newUser;
    } else {
      const existingData = userSnap.data() as UserProfile;
      // update some details if changed
      const updatedUser = {
        ...existingData,
        displayName: user.displayName || existingData.displayName,
        photoURL: user.photoURL || existingData.photoURL,
        username: user.username || existingData.username
      };
      await setDoc(userRef, updatedUser, { merge: true });
      return updatedUser;
    }
  } catch (error) {
    console.error("Error creating or updating user profile:", error);
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    console.error("Error getting user profile:", err);
    return null;
  }
}

export async function updateUserPreferences(userId: string, preferences: string[]) {
  try {
    await updateDoc(doc(db, 'users', userId), { preferences });
  } catch (err) {
    console.error("Error updating preferences:", err);
  }
}

export async function updateUserBio(userId: string, bio: string) {
  try {
    await updateDoc(doc(db, 'users', userId), { bio });
  } catch (err) {
    console.error("Error updating bio:", err);
  }
}

// Video Operations
export async function getVideos(): Promise<Video[]> {
  try {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Video);
  } catch (err) {
    console.error("Error getting videos:", err);
    return [];
  }
}

export async function uploadCustomVideo(videoData: Omit<Video, 'id' | 'likesCount' | 'commentsCount' | 'sharesCount' | 'createdAt'>): Promise<Video> {
  try {
    const videoRef = doc(collection(db, 'videos'));
    const newVideo: Video = {
      ...videoData,
      id: videoRef.id,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString()
    };
    await setDoc(videoRef, newVideo);
    return newVideo;
  } catch (err) {
    console.error("Error creating custom video:", err);
    throw err;
  }
}

// Likes Operations
export function listenToLike(videoId: string, userId: string, callback: (isLiked: boolean) => void) {
  const likeRef = doc(db, 'videos', videoId, 'likes', userId);
  return onSnapshot(likeRef, (docSnap) => {
    callback(docSnap.exists());
  });
}

export async function toggleLikeVideo(video: Video, userId: string, isCurrentlyLiked: boolean) {
  try {
    const videoRef = doc(db, 'videos', video.id);
    const likeRef = doc(db, 'videos', video.id, 'likes', userId);
    
    if (isCurrentlyLiked) {
      // Unlike
      await deleteDoc(likeRef);
      await updateDoc(videoRef, { likesCount: increment(-1) });
    } else {
      // Like
      await setDoc(likeRef, {
        userId,
        videoId: video.id,
        createdAt: new Date().toISOString()
      });
      await updateDoc(videoRef, { likesCount: increment(1) });
      
      // Create notification for video creator
      if (video.creatorId !== userId) {
        await createNotification(video.creatorId, {
          type: 'like',
          senderId: userId,
          targetId: video.id,
          text: `a aimé votre vidéo : "${video.description.substring(0, 30)}..."`
        });
      }
    }
  } catch (err) {
    console.error("Error toggling like:", err);
  }
}

// Comments Operations
export function listenToComments(videoId: string, callback: (comments: Comment[]) => void) {
  const commentsRef = collection(db, 'videos', videoId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => doc.data() as Comment);
    callback(comments);
  });
}

export async function addComment(video: Video, userId: string, username: string, userAvatar: string, text: string) {
  try {
    const commentsRef = collection(db, 'videos', video.id, 'comments');
    const commentDocRef = doc(commentsRef);
    const newComment: Comment = {
      id: commentDocRef.id,
      videoId: video.id,
      userId,
      username,
      userAvatar,
      text,
      createdAt: new Date().toISOString()
    };
    await setDoc(commentDocRef, newComment);
    
    // Increment comments count on video
    await updateDoc(doc(db, 'videos', video.id), { commentsCount: increment(1) });
    
    // Create notification for video creator
    if (video.creatorId !== userId) {
      await createNotification(video.creatorId, {
        type: 'comment',
        senderId: userId,
        targetId: video.id,
        text: `a commenté votre vidéo : "${text.substring(0, 30)}..."`
      });
    }
    return newComment;
  } catch (err) {
    console.error("Error adding comment:", err);
    throw err;
  }
}

// Follow/Subscription Operations
export function listenToFollow(followerId: string, followingId: string, callback: (isFollowing: boolean) => void) {
  const followId = `${followerId}_${followingId}`;
  const followRef = doc(db, 'follows', followId);
  return onSnapshot(followRef, (docSnap) => {
    callback(docSnap.exists());
  });
}

export async function toggleFollowUser(follower: UserProfile, followingId: string, isCurrentlyFollowing: boolean) {
  try {
    const followId = `${follower.id}_${followingId}`;
    const followRef = doc(db, 'follows', followId);
    
    if (isCurrentlyFollowing) {
      // Unfollow
      await deleteDoc(followRef);
      await updateDoc(doc(db, 'users', follower.id), { followingCount: increment(-1) });
      await updateDoc(doc(db, 'users', followingId), { followersCount: increment(-1) });
    } else {
      // Follow
      await setDoc(followRef, {
        id: followId,
        followerId: follower.id,
        followingId,
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'users', follower.id), { followingCount: increment(1) });
      await updateDoc(doc(db, 'users', followingId), { followersCount: increment(1) });
      
      // Create notification for the followed user
      await createNotification(followingId, {
        type: 'follow',
        senderId: follower.id,
        targetId: follower.id,
        text: `commencé à vous suivre`
      });
    }
  } catch (err) {
    console.error("Error toggling follow:", err);
  }
}

// Fetch all people the user follows (for Following Feed)
export async function getFollowingIds(userId: string): Promise<string[]> {
  try {
    const q = query(collection(db, 'follows'), where('followerId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => (doc.data() as Follow).followingId);
  } catch (err) {
    console.error("Error getting following ids:", err);
    return [];
  }
}

// Verify if there is mutual follow (subscription) to allow private messages
export async function checkMutualFollow(userA: string, userB: string): Promise<boolean> {
  try {
    // Check if A follows B
    const docAB = await getDoc(doc(db, 'follows', `${userA}_${userB}`));
    // Check if B follows A
    const docBA = await getDoc(doc(db, 'follows', `${userB}_${userA}`));
    return docAB.exists() && docBA.exists();
  } catch (err) {
    console.error("Error checking mutual follow:", err);
    return false;
  }
}

// Chat & DMs Operations
export function listenToUserChats(userId: string, callback: (chats: Chat[]) => void) {
  const q = query(
    collection(db, 'chats'), 
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  
  return onSnapshot(q, async (snapshot) => {
    const chatsList = snapshot.docs.map(doc => doc.data() as Chat);
    
    // Fetch profiles for the other participant dynamically
    const detailedChats = await Promise.all(chatsList.map(async (chat) => {
      const otherId = chat.participants.find(p => p !== userId) || '';
      const otherUser = await getUserProfile(otherId);
      return {
        ...chat,
        otherUser: otherUser || undefined
      };
    }));
    
    callback(detailedChats);
  });
}

export function listenToChatMessages(chatId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'), 
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => doc.data() as Message);
    callback(messages);
  });
}

export async function createOrGetChat(userAId: string, userBId: string): Promise<string> {
  try {
    const chatsRef = collection(db, 'chats');
    // Try query chats where both participants exist
    const q = query(chatsRef, where('participants', 'array-contains', userAId));
    const snap = await getDocs(q);
    
    const existingChat = snap.docs.find(doc => {
      const data = doc.data() as Chat;
      return data.participants.includes(userBId);
    });
    
    if (existingChat) {
      return existingChat.id;
    } else {
      // Create a new direct chat
      const chatDocRef = doc(collection(db, 'chats'));
      const newChat: Omit<Chat, 'otherUser'> = {
        id: chatDocRef.id,
        participants: [userAId, userBId],
        lastMessage: 'Début de votre conversation',
        lastMessageSenderId: userAId,
        lastMessageAt: new Date().toISOString(),
        unreadBy: [userBId]
      };
      await setDoc(chatDocRef, newChat);
      return chatDocRef.id;
    }
  } catch (err) {
    console.error("Error creating/getting chat:", err);
    throw err;
  }
}

export async function sendDirectMessage(chatId: string, senderId: string, receiverId: string, text: string) {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messageDocRef = doc(messagesRef);
    const newMessage: Message = {
      id: messageDocRef.id,
      senderId,
      text,
      createdAt: new Date().toISOString()
    };
    await setDoc(messageDocRef, newMessage);
    
    // Update parent Chat document
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageSenderId: senderId,
      lastMessageAt: new Date().toISOString(),
      unreadBy: [receiverId]
    });
    
    // Create direct message notification for receiver
    const senderProfile = await getUserProfile(senderId);
    if (senderProfile) {
      await createNotification(receiverId, {
        type: 'message',
        senderId,
        targetId: chatId,
        text: `vous a envoyé un message : "${text.substring(0, 30)}..."`
      });
    }
  } catch (err) {
    console.error("Error sending message:", err);
    throw err;
  }
}

export async function markChatAsRead(chatId: string, userId: string) {
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      unreadBy: arrayRemove(userId)
    });
  } catch (err) {
    console.error("Error marking chat as read:", err);
  }
}

// Notifications Operations
export function listenToNotifications(userId: string, callback: (notifications: Notification[]) => void) {
  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => doc.data() as Notification);
    callback(notifications);
  });
}

export async function createNotification(userId: string, data: { type: Notification['type'], senderId: string, targetId: string, text: string }) {
  try {
    const sender = await getUserProfile(data.senderId);
    if (!sender) return;
    
    const notifRef = doc(collection(db, 'users', userId, 'notifications'));
    const notification: Notification = {
      id: notifRef.id,
      type: data.type,
      senderId: data.senderId,
      senderName: sender.displayName,
      senderAvatar: sender.photoURL,
      targetId: data.targetId,
      text: data.text,
      read: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(notifRef, notification);
  } catch (err) {
    console.error("Error creating notification:", err);
  }
}

export async function markNotificationAsRead(userId: string, notifId: string) {
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notifId), { read: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }
}

export async function clearAllNotifications(userId: string, notifications: Notification[]) {
  try {
    for (const notif of notifications) {
      await deleteDoc(doc(db, 'users', userId, 'notifications', notif.id));
    }
  } catch (err) {
    console.error("Error clearing notifications:", err);
  }
}

// Fetch list of creators (or users who have videos or follow candidates)
export async function getAllCreators(currentUserId: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), limit(30));
    const snap = await getDocs(q);
    return snap.docs
      .map(doc => doc.data() as UserProfile)
      .filter(profile => profile.id !== currentUserId);
  } catch (err) {
    console.error("Error getting creators:", err);
    return [];
  }
}

// Complete Profile Customization Helpers
export async function updateUserProfileDetails(
  userId: string, 
  details: { displayName?: string; username?: string; bio?: string; photoURL?: string }
) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { ...details });
  } catch (err) {
    console.error("Error updating user profile details:", err);
    throw err;
  }
}

export async function getFollowers(userId: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'follows'), where('followingId', '==', userId));
    const snap = await getDocs(q);
    const followerIds = snap.docs.map(doc => (doc.data() as Follow).followerId);
    const profiles = await Promise.all(followerIds.map(id => getUserProfile(id)));
    return profiles.filter((p): p is UserProfile => p !== null);
  } catch (err) {
    console.error("Error getting followers:", err);
    return [];
  }
}

export async function getFollowing(userId: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'follows'), where('followerId', '==', userId));
    const snap = await getDocs(q);
    const followingIds = snap.docs.map(doc => (doc.data() as Follow).followingId);
    const profiles = await Promise.all(followingIds.map(id => getUserProfile(id)));
    return profiles.filter((p): p is UserProfile => p !== null);
  } catch (err) {
    console.error("Error getting following:", err);
    return [];
  }
}

export async function getLikedVideos(userId: string): Promise<Video[]> {
  try {
    const allVideos = await getVideos();
    const likedVids: Video[] = [];
    for (const video of allVideos) {
      const likeSnap = await getDoc(doc(db, 'videos', video.id, 'likes', userId));
      if (likeSnap.exists()) {
        likedVids.push(video);
      }
    }
    return likedVids;
  } catch (err) {
    console.error("Error getting liked videos:", err);
    return [];
  }
}
