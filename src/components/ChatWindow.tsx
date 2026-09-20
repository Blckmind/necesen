// src/components/ChatWindow.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  Video,
  Send,
  Smile,
  Paperclip,
  Mic,
  Trash2,
  Check,
  CheckCheck,
  FileText,
  Lock,
  ArrowLeft,
  X,
  Search,
  Camera,
  MoreVertical,
} from 'lucide-react';
import { Message, User } from '../types';
import { EmojiPicker } from './EmojiPicker';
import { QuickReactionToolbar } from './QuickReactionToolbar';
import { AudioMessageBubble } from './AudioMessageBubble';

const formatMessageTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const isSameDay = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDateDivider = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(ts, today.getTime())) return 'Bugün';
  if (isSameDay(ts, yesterday.getTime())) return 'Dünən';
  return d.toLocaleDateString('az-AZ', { day: 'numeric', month: 'long', year: 'numeric' });
};

interface ChatWindowProps {
  currentUser: User;
  activeChatUser: string;
  targetUserAvatar?: string;
  targetUserStatus?: string;
  messages: Message[];
  isTargetOnline: boolean;
  targetLastSeen?: number;
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'video' | 'audio' | 'file',
    mediaUrl?: string,
    duration?: number
  ) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onStartCall: (callType: 'voice' | 'video') => void;
  onBackToList: () => void;
  onOpenMediaLightbox: (url: string, type: 'image' | 'video') => void;
  onDeleteConversation?: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  currentUser,
  activeChatUser,
  targetUserAvatar,
  targetUserStatus,
  messages,
  isTargetOnline,
  targetLastSeen,
  onSendMessage,
  onReactMessage,
  onStartCall,
  onBackToList,
  onOpenMediaLightbox,
  onDeleteConversation,
  onDeleteMessage,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [moreEmojiForMessageId, setMoreEmojiForMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showDeleteConvConfirm, setShowDeleteConvConfirm] = useState<boolean>(false);
  const [msgToDelete, setMsgToDelete] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    dataUrl: string;
    type: 'image' | 'video' | 'file';
  } | null>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Cihaz səs qeydini dəstəkləmir.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Mikrofona icazə verilmədi və ya mikrofon tapılmadı.');
    }
  };

  const stopAndSendAudio = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    const finalDuration = recordingSeconds;
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        onSendMessage('Səsli mesaj', 'audio', base64Audio, finalDuration);
      };
      reader.readAsDataURL(audioBlob);
      setIsRecording(false);
    };
    mediaRecorderRef.current.stop();
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
  };

  const handleSendText = () => {
    const trimmed = inputText.trim();
    if (!trimmed && !selectedFile) return;
    if (selectedFile) {
      onSendMessage(
        trimmed || selectedFile.file.name,
        selectedFile.type,
        selectedFile.dataUrl
      );
      setSelectedFile(null);
    } else {
      onSendMessage(trimmed, 'text');
    }
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      let type: 'image' | 'video' | 'file' = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      setSelectedFile({
        file,
        dataUrl: result,
        type,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return 'Uzun müddətdir görünməyib';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Son görülmə: bu gün ${d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Son görülmə: ${d.toLocaleDateString('az-AZ')} ${d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div
      id="chat-window-container"
      className="flex-1 h-full min-w-0 w-full flex flex-col bg-[#0b0c0f] relative overflow-hidden"
      onClick={() => {
        setActiveReactionMessageId(null);
        setMoreEmojiForMessageId(null);
      }}
    >
      <div className="h-16 px-3 sm:px-4 bg-[#0e1015] border-b border-zinc-800/60 flex items-center justify-between z-20 shrink-0 min-w-0 w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2 overflow-hidden">
          <button
            id="chat-back-btn"
            type="button"
            onClick={onBackToList}
            className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative shrink-0">
            {targetUserAvatar ? (
              <img
                src={targetUserAvatar}
                alt={activeChatUser}
                onClick={() => onOpenMediaLightbox(targetUserAvatar, 'image')}
                className="w-10 h-10 rounded-full object-cover border border-zinc-700 cursor-pointer hover:border-[#00ff66] transition-colors shadow-sm"
                title="Profil şəklinə bax"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white uppercase text-sm">
                {activeChatUser.slice(0, 2)}
              </div>
            )}
            {isTargetOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00ff66] border-2 border-[#12131a]" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{activeChatUser}</span>
              {activeChatUser.toLowerCase() === 'khabib' && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 text-[#00ff66] border border-emerald-800 font-mono shrink-0">
                  ADMIN
                </span>
              )}
            </span>
            <span className="text-[11px] flex items-center gap-1.5 truncate text-zinc-400">
              {isTargetOnline ? (
                <>
                  <span className="text-[#00ff66] font-medium shrink-0">onlayn</span>
                  {targetUserStatus && (
                    <>
                      <span className="text-zinc-600 shrink-0">•</span>
                      <span className="truncate">{targetUserStatus}</span>
                    </>
                  )}
                </>
              ) : targetUserStatus ? (
                <span className="truncate">{targetUserStatus}</span>
              ) : (
                <span className="truncate">{formatLastSeen(targetLastSeen)}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            id="chat-search-toggle-btn"
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showSearch ? 'bg-zinc-800 text-[#00ff66]' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Mesajlarda axtar"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            id="chat-start-voice-call-btn"
            type="button"
            onClick={() => onStartCall('voice')}
            className="p-2 rounded-full text-zinc-400 hover:text-[#00ff66] hover:bg-zinc-800 transition-colors cursor-pointer"
            title="WhatsApp Səsli zəng"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            id="chat-start-video-call-btn"
            type="button"
            onClick={() => onStartCall('video')}
            className="p-2 rounded-full text-zinc-400 hover:text-[#00ff66] hover:bg-zinc-800 transition-colors cursor-pointer"
            title="WhatsApp Video zəng"
          >
            <Video className="w-5 h-5" />
          </button>
          {onDeleteConversation && (
            <button
              id="chat-delete-conv-btn"
              type="button"
              onClick={() => setShowDeleteConvConfirm(true)}
              className="p-2 rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Yazışmanı sil"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="px-4 py-2 bg-[#171822] border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mesajlarda axtar..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#0e0e14] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        id="chat-messages-container"
        ref={chatMessagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-3 relative"
      >
        <div className="flex justify-center my-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#181920]/90 border border-zinc-800/80 text-[11px] text-amber-300/80 max-w-sm text-center shadow-sm">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Mesajlar və zənglər ucdan-uca şifrələnir. Khami daxil olmaqla heç kim oxuya və dinləyə bilməz.</span>
          </div>
        </div>

        {filteredMessages.map((msg, index) => {
          const isSender = msg.sender.toLowerCase() === currentUser.username.toLowerCase();
          const userReaction = msg.reactions?.[currentUser.username];
          const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
          const reactionCounts: Record<string, number> = {};
          if (msg.reactions) {
            Object.values(msg.reactions).forEach((em) => {
              reactionCounts[em] = (reactionCounts[em] || 0) + 1;
            });
          }
          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
          const showDateDivider = !prevMsg || !isSameDay(prevMsg.timestamp, msg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="flex justify-center my-3 select-none">
                  <span className="px-3 py-1 rounded-lg bg-[#181920] border border-zinc-800/80 text-[11px] text-zinc-400 shadow-xs uppercase tracking-wide">
                    {formatDateDivider(msg.timestamp)}
                  </span>
                </div>
              )}
              <div
                id={`message-bubble-${msg.id}`}
                className={`flex flex-col group ${isSender ? 'items-end' : 'items-start'} ${
                  hasReactions ? 'mb-3.5' : 'mb-1'
                }`}
              >
                <div className="relative max-w-[85%] sm:max-w-[70%] md:max-w-[65%]">
                  {activeReactionMessageId === msg.id && (
                    <QuickReactionToolbar
                      isOpen={true}
                      onReact={(emoji) => onReactMessage(msg.id, emoji)}
                      onOpenMore={() => setMoreEmojiForMessageId(msg.id)}
                      onClose={() => setActiveReactionMessageId(null)}
                      isSender={isSender}
                      currentReaction={userReaction}
                    />
                  )}

                  {moreEmojiForMessageId === msg.id && (
                    <div className="absolute bottom-12 z-40" onClick={(e) => e.stopPropagation()}>
                      <EmojiPicker
                        isOpen={true}
                        onSelectEmoji={(emoji) => {
                          onReactMessage(msg.id, emoji);
                          setMoreEmojiForMessageId(null);
                          setActiveReactionMessageId(null);
                        }}
                        onClose={() => setMoreEmojiForMessageId(null)}
                      />
                    </div>
                  )}

                  <div
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id);
                    }}
                    className={`relative shadow-xs select-text transition-all ${
                      isSender
                        ? 'bg-[#005c4b] text-[#e9edef] rounded-[15px] rounded-tr-[3px]'
                        : 'bg-[#202c33] text-[#e9edef] rounded-[15px] rounded-tl-[3px]'
                    }`}
                  >
                    <div
                      className={`absolute -top-7 ${
                        isSender ? 'right-1' : 'left-1'
                      } opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity z-10`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id);
                        }}
                        className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors cursor-pointer shadow-xs"
                        title="Reaksiya bildir"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteMessage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMsgToDelete(msg.id);
                          }}
                          className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors cursor-pointer shadow-xs"
                          title="Mesajı sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {msg.type === 'image' && msg.mediaUrl ? (
                      <div className="p-1 pb-1.5">
                        <div className="rounded-lg overflow-hidden cursor-pointer relative">
                          <img
                            src={msg.mediaUrl}
                            alt="Şəkil"
                            onClick={() => onOpenMediaLightbox(msg.mediaUrl!, 'image')}
                            className="max-w-full max-h-[320px] rounded-lg object-cover hover:opacity-95 transition-opacity"
                          />
                        </div>
                        {msg.content && msg.content !== 'Şəkil' ? (
                          <div className="relative pt-1.5 px-1.5 min-w-[120px]">
                            <div className="text-[14.2px] text-[#e9edef] leading-[19px] whitespace-pre-wrap break-words select-text">
                              <span>{msg.content}</span>
                              <span
                                className="inline-block select-none pointer-events-none align-baseline ml-2"
                                style={{ width: isSender ? '64px' : '42px', height: '11px' }}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="absolute right-1 bottom-0.5 inline-flex items-center gap-1 select-none pointer-events-none">
                              <span className="text-[11px] text-[#8696a0] leading-none">
                                {formatMessageTime(msg.timestamp)}
                              </span>
                              {isSender && (
                                <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                                  {msg.status === 'read' || msg.status === 'seen' ? (
                                    <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] stroke-[2.3]" />
                                  ) : msg.status === 'delivered' ? (
                                    <CheckCheck className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                                  ) : (
                                    <Check className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                                  )}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs select-none pointer-events-none">
                            <span className="text-[10px] text-white/90 leading-none">
                              {formatMessageTime(msg.timestamp)}
                            </span>
                            {isSender && (
                              <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                                {msg.status === 'read' || msg.status === 'seen' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.3]" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-white/80 stroke-[1.9]" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-white/80 stroke-[1.9]" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'video' && msg.mediaUrl ? (
                      <div className="p-1 pb-1.5">
                        <div className="rounded-lg overflow-hidden">
                          <video src={msg.mediaUrl} controls className="max-w-full max-h-[260px] rounded-lg" />
                        </div>
                        {msg.content && msg.content !== 'Video' ? (
                          <div className="relative pt-1.5 px-1.5 min-w-[120px]">
                            <div className="text-[14.2px] text-[#e9edef] leading-[19px] whitespace-pre-wrap break-words select-text">
                              <span>{msg.content}</span>
                              <span
                                className="inline-block select-none pointer-events-none align-baseline ml-2"
                                style={{ width: isSender ? '64px' : '42px', height: '11px' }}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="absolute right-1 bottom-0.5 inline-flex items-center gap-1 select-none pointer-events-none">
                              <span className="text-[11px] text-[#8696a0] leading-none">
                                {formatMessageTime(msg.timestamp)}
                              </span>
                              {isSender && (
                                <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                                  {msg.status === 'read' || msg.status === 'seen' ? (
                                    <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] stroke-[2.3]" />
                                  ) : msg.status === 'delivered' ? (
                                    <CheckCheck className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                                  ) : (
                                    <Check className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                                  )}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 px-2 pt-1 select-none pointer-events-none">
                            <span className="text-[10px] text-[#8696a0] leading-none">
                              {formatMessageTime(msg.timestamp)}
                            </span>
                            {isSender && (
                              <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                                {msg.status === 'read' || msg.status === 'seen' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.3]" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#8696a0] stroke-[1.9]" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-[#8696a0] stroke-[1.9]" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'audio' && msg.mediaUrl ? (
                      <div className="p-1 pb-1">
                        <AudioMessageBubble mediaUrl={msg.mediaUrl} duration={msg.duration} isSender={isSender} />
                        <div className="flex items-center justify-end gap-1 px-2 pb-0.5 -mt-0.5 select-none pointer-events-none">
                          <span className="text-[11px] text-[#8696a0] leading-none">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                          {isSender && (
                            <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                              {msg.status === 'read' || msg.status === 'seen' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] stroke-[2.3]" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              ) : (
                                <Check className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : msg.type === 'file' && msg.mediaUrl ? (
                      <div className="p-2 min-w-[200px]">
                        <a
                          href={msg.mediaUrl}
                          download={msg.content || 'fayl'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#00ff66]/15 border border-[#00ff66]/30 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-[#00ff66]" />
                          </div>
                          <div className="flex-1 truncate">
                            <p className="text-xs font-mono text-[#e9edef] truncate">{msg.content || 'Sənəd'}</p>
                            <p className="text-[10px] text-zinc-400">Yüklə</p>
                          </div>
                        </a>
                        <div className="flex items-center justify-end gap-1 px-1 pt-1.5 select-none pointer-events-none">
                          <span className="text-[11px] text-[#8696a0] leading-none">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                          {isSender && (
                            <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                              {msg.status === 'read' || msg.status === 'seen' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] stroke-[2.3]" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              ) : (
                                <Check className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative pt-1.5 pb-1.5 px-3 min-w-[76px]">
                        <div className="text-[14.2px] text-[#e9edef] leading-[19px] whitespace-pre-wrap break-words select-text">
                          <span>{msg.content}</span>
                          <span
                            className="inline-block select-none pointer-events-none align-baseline ml-2"
                            style={{ width: isSender ? '64px' : '42px', height: '11px' }}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="absolute right-2.5 bottom-1.5 inline-flex items-center gap-1 select-none pointer-events-none">
                          <span className="text-[11px] text-[#8696a0] leading-none">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                          {isSender && (
                            <span className="inline-flex items-center self-center shrink-0 -mr-0.5">
                              {msg.status === 'read' || msg.status === 'seen' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#53bdeb] stroke-[2.3]" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              ) : (
                                <Check className="w-[15px] h-[15px] text-[#8696a0] stroke-[1.9]" />
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasReactions && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReactionMessageId(msg.id);
                      }}
                      className={`absolute -bottom-2.5 ${
                        isSender ? 'right-2' : 'left-2'
                      } flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#182229] border border-zinc-700/80 shadow-md cursor-pointer hover:scale-105 transition-transform z-10 text-xs`}
                    >
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span key={emoji} className="flex items-center">
                          <span>{emoji}</span>
                          {count > 1 && (
                            <span className="text-[10px] text-zinc-400 font-mono ml-0.5">{count}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {selectedFile && (
        <div className="px-4 py-2 bg-[#171822] border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {selectedFile.type === 'image' ? (
              <img
                src={selectedFile.dataUrl}
                alt="Fayl önbaxış"
                className="w-10 h-10 object-cover rounded-lg border border-zinc-700 shrink-0"
              />
            ) : selectedFile.type === 'video' ? (
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-[#00ff66]" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#00ff66]" />
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-mono text-white truncate">{selectedFile.file.name}</p>
              <p className="text-[10px] font-mono text-zinc-500">
                {(selectedFile.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="p-1 rounded-md text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-18 left-3 z-40" onClick={(e) => e.stopPropagation()}>
          <EmojiPicker
            isOpen={true}
            onSelectEmoji={(emoji) => {
              setInputText((prev) => prev + emoji);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      <div className="px-2 pt-1.5 pb-2 z-20 shrink-0 bg-transparent">
        {isRecording ? (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-[#1e2027] border border-zinc-700/80 shadow-lg">
            <div className="flex items-center gap-2 text-red-500">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-white">
                Qeyd olunur... {formatTime(recordingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelAudioRecording}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                title="Ləğv et"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={stopAndSendAudio}
                className="p-2 rounded-full bg-[#00a884] text-white hover:bg-[#009b7a] transition-colors cursor-pointer shadow-sm"
                title="Göndər"
              >
                <Send className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex-1 h-12 rounded-[26px] bg-[#1e2027] border border-white/5 flex items-center px-3 gap-2 shadow-sm min-w-0">
              <button
                id="input-emoji-toggle-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker((prev) => !prev);
                }}
                className="text-[#8e929b] hover:text-white transition-colors cursor-pointer shrink-0 p-0.5"
                title="Emoji"
              >
                <Smile className="w-6 h-6" />
              </button>
              <input
                ref={textInputRef}
                id="message-text-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      const file = items[i].getAsFile();
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const result = reader.result as string;
                          onSendMessage('GIF / Stiker', 'image', result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder="Mesaj"
                className="flex-1 bg-transparent text-white placeholder-[#8e929b] text-[15px] focus:outline-none min-w-0 px-1"
              />
              <button
                id="input-attachment-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#8e929b] hover:text-white transition-colors cursor-pointer shrink-0 p-1"
                title="Fayl əlavə et"
              >
                <Paperclip className="w-5 h-5 -rotate-45" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                id="input-camera-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[#8e929b] hover:text-white transition-colors cursor-pointer shrink-0 p-1"
                title="Kamera / Şəkil"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {inputText.trim() || selectedFile ? (
              <button
                id="message-send-btn"
                type="button"
                onClick={handleSendText}
                className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#009b7a] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
                title="Göndər"
              >
                <Send className="w-5 h-5 fill-current ml-0.5" />
              </button>
            ) : (
              <button
                id="message-mic-btn"
                type="button"
                onClick={startAudioRecording}
                className="w-12 h-12 rounded-full bg-white hover:bg-zinc-100 active:scale-95 text-[#111b21] flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0"
                title="Səsli mesaj göndər"
              >
                <Mic className="w-6 h-6" />
              </button>
            )}
          </div>
        )}
      </div>

      {showDeleteConvConfirm && (
        <div
          id="chat-delete-conv-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setShowDeleteConvConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Yazışmanı silmək istəyirsiniz?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              <span className="text-white font-semibold font-mono">"{activeChatUser}"</span> ilə olan bütün mesajlar və yazışma tarixçəsi silinəcək.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowDeleteConvConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                id="chat-confirm-delete-btn"
                type="button"
                onClick={() => {
                  setShowDeleteConvConfirm(false);
                  onDeleteConversation?.();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                Bəli, sil
              </button>
            </div>
          </div>
        </div>
      )}

      {msgToDelete && (
        <div
          id="chat-delete-msg-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setMsgToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Mesajı silmək istəyirsiniz?</h3>
            <p className="text-xs text-zinc-400 mb-5">Bu mesaj hər iki tərəfdən silinəcək.</p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setMsgToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                id="confirm-delete-msg-btn"
                type="button"
                onClick={() => {
                  if (msgToDelete) {
                    onDeleteMessage?.(msgToDelete);
                    setMsgToDelete(null);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
