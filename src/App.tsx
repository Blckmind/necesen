import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message, Conversation, ActiveCall, CallLog } from './types';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { CallModal } from './components/CallModal';
import { NewChatModal } from './components/NewChatModal';
import { NewCallModal } from './components/NewCallModal';
import { AdminModal } from './components/AdminModal';
import { ProfileModal } from './components/ProfileModal';
import { MediaLightbox } from './components/MediaLightbox';
import { KhamiLogo } from './components/KhamiLogo';
import { soundManager } from './utils/audio';
import { webrtcManager } from './utils/webrtc';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('khami_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'calls'>('chats');

  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [isNewCallOpen, setIsNewCallOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Partner Profile (avatar & status & lastSeen)
  const [partnerProfile, setPartnerProfile] = useState<{ avatar?: string; statusMessage?: string; lastSeen?: number }>({});

  // WebSocket Ref & Call ID Ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const currentCallIdRef = useRef<string | null>(null);

  // Load conversations list for current user
  const fetchConversations = useCallback(async (username: string) => {
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
    }
  }, []);

  // Load call history logs for current user
  const fetchCallLogs = useCallback(async (username: string) => {
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setCallLogs(data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch call logs:', err);
    }
  }, []);

  // Delete single call log
  const handleDeleteCallLog = async (callId: string) => {
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCallLogs((prev) => prev.filter((c) => c.id !== callId));
      }
    } catch (err) {
      console.warn('Failed to delete call log:', err);
    }
  };

  // Clear all call logs for user
  const handleClearAllCallLogs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/calls/clear/${encodeURIComponent(currentUser.username)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCallLogs([]);
      }
    } catch (err) {
      console.warn('Failed to clear call logs:', err);
    }
  };

  // Load chat messages when activeChatUser changes
  const fetchMessages = useCallback(async (user1: string, user2: string) => {
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);

        // Mark messages as read via WS
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'mark_read',
            sender: user1,
            targetUser: user2
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    }
  }, []);

  // Initialize and maintain WebSocket connection
  const connectWebSocket = useCallback((user: User) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate socket session
      ws.send(JSON.stringify({
        type: 'auth',
        username: user.username
      }));
      // Fetch initial data
      fetchConversations(user.username);
      fetchCallLogs(user.username);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'online_users':
            setOnlineUsers(data.users || []);
            break;

          case 'user_status':
            setOnlineUsers((prev) => {
              const lower = data.username.toLowerCase();
              if (data.isOnline) {
                return prev.includes(lower) ? prev : [...prev, lower];
              } else {
                return prev.filter((u) => u !== lower);
              }
            });
            break;

          case 'chat_message': {
            const newMsg: Message = data.message;
            // Play incoming sound if not our own message
            if (newMsg.sender.toLowerCase() !== user.username.toLowerCase()) {
              soundManager.playMessageReceived();
            }

            // Append if current active chat matches
            setActiveChatUser((curActive) => {
              const isRelevant =
                curActive &&
                (newMsg.sender.toLowerCase() === curActive.toLowerCase() ||
                  newMsg.recipient.toLowerCase() === curActive.toLowerCase());

              if (isRelevant) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });

                // Auto mark as read if chat is open
                if (newMsg.sender.toLowerCase() === curActive?.toLowerCase() && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'mark_read',
                    sender: user.username,
                    targetUser: curActive
                  }));
                }
              }
              return curActive;
            });

            // Refresh conversations list
            fetchConversations(user.username);
            break;
          }

          case 'message_delivered': {
            setMessages((prev) =>
              prev.map((m) => (m.id === data.messageId ? { ...m, status: 'delivered' } : m))
            );
            break;
          }

          case 'messages_read': {
            setMessages((prev) =>
              prev.map((m) =>
                m.recipient.toLowerCase() === data.reader.toLowerCase() ? { ...m, status: 'read' } : m
              )
            );
            fetchConversations(user.username);
            break;
          }

          case 'message_reaction': {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === data.messageId) {
                  return {
                    ...m,
                    reactions: {
                      ...(m.reactions || {}),
                      [data.username]: data.emoji
                    }
                  };
                }
                return m;
              })
            );
            break;
          }

          case 'call_signal': {
            const { signalType, from, callType, payload, callId } = data;
            if (signalType === 'call_request') {
              // Incoming call prompt
              currentCallIdRef.current = callId || `call_${Date.now()}`;
              setActiveCall({
                targetUser: from,
                callType: callType || 'voice',
                isIncoming: true,
                status: 'ringing'
              });
            } else if (signalType === 'call_accepted') {
              // Remote peer accepted call
              setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
              fetchCallLogs(user.username);
            } else if (signalType === 'call_rejected') {
              soundManager.stopRingback();
              soundManager.playCallEnd();
              setActiveCall(null);
              currentCallIdRef.current = null;
              fetchCallLogs(user.username);
              alert(`${from} zəngi rədd etdi.`);
            } else if (signalType === 'call_ended') {
              soundManager.stopRinging();
              soundManager.stopRingback();
              soundManager.playCallEnd();
              setActiveCall(null);
              currentCallIdRef.current = null;
              fetchCallLogs(user.username);
            } else if (signalType === 'webrtc_offer') {
              if (payload?.offer) {
                const answer = await webrtcManager.handleOffer(payload.offer);
                if (answer && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'call_signal',
                    sender: user.username,
                    targetUser: from,
                    signalType: 'webrtc_answer',
                    payload: { answer }
                  }));
                }
              }
            } else if (signalType === 'webrtc_answer') {
              if (payload?.answer) {
                await webrtcManager.handleAnswer(payload.answer);
              }
            } else if (signalType === 'webrtc_ice') {
              if (payload?.candidate) {
                await webrtcManager.addIceCandidate(payload.candidate);
              }
            }
            break;
          }

          case 'call_log_updated': {
            fetchCallLogs(user.username);
            break;
          }

          case 'blocked_by_admin': {
            alert('Hesabınız admin tərəfindən bloklandı.');
            handleLogout();
            break;
          }

          case 'all_messages_cleared': {
            setMessages([]);
            fetchConversations(user.username);
            break;
          }

          case 'conversation_deleted': {
            fetchConversations(user.username);
            if (activeChatUser && data.peer && activeChatUser.toLowerCase() === data.peer.toLowerCase()) {
              setMessages([]);
              setActiveChatUser(null);
            }
            break;
          }

          case 'message_deleted': {
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
            fetchConversations(user.username);
            break;
          }

          case 'profile_updated': {
            // Live update conversation partner's avatar and status
            setConversations((prev) =>
              prev.map((c) =>
                c.user.toLowerCase() === data.username.toLowerCase()
                  ? { ...c, avatar: data.avatar, statusMessage: data.statusMessage }
                  : c
              )
            );
            // If it's current user's profile, update current user state
            setCurrentUser((prev) => {
              if (prev && prev.username.toLowerCase() === data.username.toLowerCase()) {
                const updated = { ...prev, avatar: data.avatar, statusMessage: data.statusMessage };
                localStorage.setItem('khami_user', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
            break;
          }
        }
      } catch (err) {
        console.warn('WS message parse error:', err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (currentUser) {
          connectWebSocket(currentUser);
        }
      }, 2000);
    };
  }, [currentUser, fetchConversations]);

  // Connect WebSocket and fetch conversations on user login
  useEffect(() => {
    if (currentUser) {
      connectWebSocket(currentUser);
      fetchConversations(currentUser.username);
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUser, connectWebSocket, fetchConversations]);

  // Fetch messages when activeChatUser changes
  useEffect(() => {
    if (currentUser && activeChatUser) {
      fetchMessages(currentUser.username, activeChatUser);
    }
  }, [currentUser, activeChatUser, fetchMessages]);

  // Fetch partner profile (avatar, status, lastSeen) when activeChatUser changes
  useEffect(() => {
    if (!activeChatUser) {
      setPartnerProfile({});
      return;
    }

    const currentConv = conversations.find(
      (c) => c.user.toLowerCase() === activeChatUser.toLowerCase()
    );
    if (currentConv) {
      setPartnerProfile((prev) => ({
        ...prev,
        avatar: currentConv.avatar,
        statusMessage: currentConv.statusMessage
      }));
    }

    fetch(`/api/user/${encodeURIComponent(activeChatUser)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setPartnerProfile({
            avatar: data.user.avatar,
            statusMessage: data.user.statusMessage,
            lastSeen: data.user.lastSeen
          });
        }
      })
      .catch(() => {});
  }, [activeChatUser]);

  // Handle Login or Registration Success
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('khami_user', JSON.stringify(user));
    } catch {}
  };

  // Handle Logout
  const handleLogout = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentUser(null);
    setActiveChatUser(null);
    setMessages([]);
    setActiveCall(null);
    try {
      localStorage.removeItem('khami_user');
    } catch {}
  };

  // Send Message
  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text',
    mediaUrl?: string,
    duration?: number
  ) => {
    if (!currentUser || !activeChatUser) return;
    soundManager.playMessageSent();

    const tempMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender: currentUser.username,
      recipient: activeChatUser,
      type,
      content,
      mediaUrl,
      duration,
      timestamp: Date.now(),
      status: 'sent'
    };

    // Optimistically append to message list
    setMessages((prev) => [...prev, tempMessage]);

    // Send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        message: tempMessage
      }));
    }
  };

  // React to Message
  const handleReactMessage = (messageId: string, emoji: string) => {
    if (!currentUser || !activeChatUser) return;

    // Optimistically update local message reaction
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            reactions: {
              ...(m.reactions || {}),
              [currentUser.username]: emoji
            }
          };
        }
        return m;
      })
    );

    // Send reaction via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'react_message',
        messageId,
        username: currentUser.username,
        targetUser: activeChatUser,
        emoji
      }));
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (targetUser: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/conversation/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(targetUser)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.user.toLowerCase() !== targetUser.toLowerCase()));
        if (activeChatUser?.toLowerCase() === targetUser.toLowerCase()) {
          setActiveChatUser(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.warn('Failed to delete conversation:', err);
    }
  };

  // Delete Individual Message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/message/${encodeURIComponent(messageId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (currentUser) {
          fetchConversations(currentUser.username);
        }
      }
    } catch (err) {
      console.warn('Failed to delete message:', err);
    }
  };

  // Start Voice or Video Call
  const handleStartCall = (callType: 'voice' | 'video', targetUserOverride?: string) => {
    const target = targetUserOverride || activeChatUser;
    if (!currentUser || !target) return;

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    currentCallIdRef.current = callId;

    setActiveCall({
      targetUser: target,
      callType,
      isIncoming: false,
      status: 'calling'
    });

    // Save call log initiated
    fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: callId,
        caller: currentUser.username,
        recipient: target,
        callType,
        status: 'missed',
        duration: 0,
        timestamp: Date.now()
      })
    }).catch(() => {});

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: target,
        callType,
        signalType: 'call_request',
        callId
      }));
    }
  };

  // Accept Incoming Call
  const handleAcceptCall = () => {
    if (!currentUser || !activeCall) return;

    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    if (currentCallIdRef.current) {
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.isIncoming ? activeCall.targetUser : currentUser.username,
          recipient: activeCall.isIncoming ? currentUser.username : activeCall.targetUser,
          callType: activeCall.callType,
          status: 'completed',
          duration: 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_accepted',
        callId: currentCallIdRef.current
      }));
    }
  };

  // Decline Incoming Call
  const handleDeclineCall = () => {
    if (!currentUser || !activeCall) return;

    if (currentCallIdRef.current) {
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.targetUser,
          recipient: currentUser.username,
          callType: activeCall.callType,
          status: 'declined',
          duration: 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_rejected',
        callId: currentCallIdRef.current
      }));
    }
    soundManager.stopRinging();
    setActiveCall(null);
    currentCallIdRef.current = null;
    fetchCallLogs(currentUser.username);
  };

  // End Active Call
  const handleEndCall = (duration?: number) => {
    if (!currentUser || !activeCall) return;

    if (currentCallIdRef.current) {
      const isConnected = activeCall.status === 'connected';
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.isIncoming ? activeCall.targetUser : currentUser.username,
          recipient: activeCall.isIncoming ? currentUser.username : activeCall.targetUser,
          callType: activeCall.callType,
          status: isConnected ? 'completed' : (activeCall.isIncoming ? 'missed' : 'declined'),
          duration: duration || 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_ended',
        callDuration: duration || 0,
        callId: currentCallIdRef.current
      }));
    }
    soundManager.stopRinging();
    soundManager.stopRingback();
    soundManager.playCallEnd();
    setActiveCall(null);
    currentCallIdRef.current = null;
    fetchCallLogs(currentUser.username);
  };

  // Send WebRTC Signaling payload
  const handleSendCallSignal = (signalType: string, payload?: any) => {
    if (!currentUser || !activeCall) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType,
        payload
      }));
    }
  };

  // 1. Splash Screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // 2. Authentication Screen if not logged in
  if (!currentUser) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // 3. Main Messenger Dashboard Layout
  return (
    <div id="khami-messenger-app" className="h-full w-full flex bg-[#08080b] text-[#e4e4e7] overflow-hidden select-none">
      {/* Sidebar: hidden on mobile when a chat is open */}
      <div className={`h-full shrink-0 ${activeChatUser ? 'hidden md:flex md:w-80 lg:w-96' : 'flex w-full md:w-80 lg:w-96'}`}>
        <Sidebar
          currentUser={currentUser}
          conversations={conversations}
          activeChatUser={activeChatUser}
          onlineUsers={onlineUsers}
          callLogs={callLogs}
          activeTab={sidebarTab}
          onChangeTab={setSidebarTab}
          onSelectChat={(user) => setActiveChatUser(user)}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={handleLogout}
          onDeleteConversation={handleDeleteConversation}
          onStartCall={(targetUser, callType) => handleStartCall(callType, targetUser)}
          onDeleteCallLog={handleDeleteCallLog}
          onClearAllCallLogs={handleClearAllCallLogs}
          onOpenNewCallModal={() => setIsNewCallOpen(true)}
        />
      </div>

      {/* Main Chat Viewport */}
      <div className={`flex-1 h-full min-w-0 flex flex-col ${!activeChatUser ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
        {activeChatUser ? (
          <ChatWindow
            currentUser={currentUser}
            activeChatUser={activeChatUser}
            targetUserAvatar={partnerProfile.avatar}
            targetUserStatus={partnerProfile.statusMessage}
            targetLastSeen={partnerProfile.lastSeen}
            messages={messages}
            isTargetOnline={onlineUsers.includes(activeChatUser.toLowerCase())}
            onSendMessage={handleSendMessage}
            onReactMessage={handleReactMessage}
            onStartCall={handleStartCall}
            onBackToList={() => setActiveChatUser(null)}
            onOpenMediaLightbox={(url, type) => setLightboxMedia({ url, type })}
            onDeleteConversation={() => handleDeleteConversation(activeChatUser)}
            onDeleteMessage={handleDeleteMessage}
          />
        ) : (
          /* Empty Chat Splash Placeholder */
          <div className="flex-1 h-full hidden md:flex flex-col items-center justify-center p-8 text-center bg-[#0e0f14] select-none border-l border-zinc-800/80">
            <div className="mb-6 opacity-30">
              <KhamiLogo className="w-24 h-24" strokeWidth={4} />
            </div>
            <h3 className="text-xl font-bold font-montserrat tracking-widest text-white uppercase mb-2">
              Khami Mesaj Platforması
            </h3>
            <p className="text-xs text-zinc-500 font-mono-tech max-w-sm leading-relaxed mb-6">
              Söhbət seçin və ya yuxarıdakı <strong className="text-white">+</strong> düyməsinə klikləyərək yeni təhlükəsiz söhbət başladın
            </p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="px-5 py-2.5 rounded-lg neon-btn-green font-mono-tech text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Yeni Söhbət Başlat
            </button>
          </div>
        )}
      </div>

      {/* Call Modal for Voice and Video */}
      {activeCall && (
        <CallModal
          currentUser={currentUser.username}
          activeCall={activeCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onEndCall={handleEndCall}
          onSendSignal={handleSendCallSignal}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        currentUser={currentUser.username}
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectUser={(user) => {
          setActiveChatUser(user);
          fetchConversations(currentUser.username);
        }}
      />

      {/* New Call Modal */}
      <NewCallModal
        currentUser={currentUser.username}
        isOpen={isNewCallOpen}
        conversations={conversations}
        onClose={() => setIsNewCallOpen(false)}
        onStartCall={(targetUser, callType) => {
          handleStartCall(callType, targetUser);
        }}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        currentUser={currentUser.username}
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onOpenChat={(targetUsername) => {
          setActiveChatUser(targetUsername);
          fetchConversations(currentUser.username);
        }}
      />

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <ProfileModal
          currentUser={currentUser}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onUpdateProfile={(updatedUser) => {
            setCurrentUser(updatedUser);
            try {
              localStorage.setItem('khami_user', JSON.stringify(updatedUser));
            } catch {}
            fetchConversations(updatedUser.username);
          }}
        />
      )}

      {/* Media Lightbox Viewer */}
      <MediaLightbox
        mediaUrl={lightboxMedia?.url || null}
        mediaType={lightboxMedia?.type || null}
        onClose={() => setLightboxMedia(null)}
      />
    </div>
  );
}
