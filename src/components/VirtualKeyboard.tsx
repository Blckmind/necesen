import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Delete, 
  CornerDownLeft, 
  Smile, 
  ArrowUp, 
  LayoutGrid, 
  Settings, 
  Languages, 
  Palette, 
  Mic, 
  Globe, 
  ChevronDown,
  X
} from 'lucide-react';
import { EMOJI_CATEGORIES } from '../utils/emojis';

interface VirtualKeyboardProps {
  isOpen: boolean;
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onClose: () => void;
  activeMode?: 'letters' | 'emojis';
}

// Layout 1: Gboard AZ • TR (10 keys with superscripts)
const ROW_1_GBOARD = [
  { key: 'q', sup: '1' },
  { key: 'ə', sup: '2' },
  { key: 'e', sup: '3' },
  { key: 'r', sup: '4' },
  { key: 't', sup: '5' },
  { key: 'y', sup: '6' },
  { key: 'u', sup: '7' },
  { key: 'i', sup: '8' },
  { key: 'o', sup: '9' },
  { key: 'p', sup: '0' }
];
const ROW_2_GBOARD = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const ROW_3_GBOARD = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

// Layout 2: Full Azerbaijani layout (from 2nd photo)
const ROW_1_AZ_FULL = ['q', 'ü', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'ö', 'ğ'];
const ROW_2_AZ_FULL = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ı', 'ə'];
const ROW_3_AZ_FULL = ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ç', 'ş'];

// Number & symbol layouts
const ROW_1_NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const ROW_2_SYM = ['@', '#', '$', '_', '&', '-', '+', '(', ')'];
const ROW_3_SYM = ['*', '"', '\'', ':', ';', '!', '?', '/'];

const ROW_1_EXTRA_SYM = ['~', '`', '|', '•', '√', 'π', '÷', '×', '§', 'Δ'];
const ROW_2_EXTRA_SYM = ['£', '€', '¥', '^', '°', '=', '{', '}', '\\', '%'];
const ROW_3_EXTRA_SYM = ['<', '>', '[', ']', '™', '®', '©', '¶', '¿'];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  isOpen,
  onKeyPress,
  onBackspace,
  onEnter,
  onClose,
  activeMode = 'letters'
}) => {
  // 'gboard' = Layout 1 (AZ • TR phone layout), 'az_full' = Layout 2 (Photo 2 full layout)
  const [layoutVariant, setLayoutVariant] = useState<'gboard' | 'az_full'>('gboard');
  const [isShift, setIsShift] = useState<boolean>(true); 
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [keyLayout, setKeyLayout] = useState<'alpha' | 'num' | 'sym'>('alpha');
  const [currentTab, setCurrentTab] = useState<'keyboard' | 'emojis' | 'gifs'>('keyboard');
  const [activeEmojiCat, setActiveEmojiCat] = useState<string>('smileys');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<'dark' | 'amoled' | 'blue'>('dark');
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);

  const backspaceTimerRef = useRef<any>(null);
  const longPressTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (activeMode === 'emojis') {
      setCurrentTab('emojis');
    } else {
      setCurrentTab('keyboard');
    }
  }, [activeMode]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (backspaceTimerRef.current) clearInterval(backspaceTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  if (!isOpen) return null;

  // Toggle between Layout 1 (Gboard AZ•TR) and Layout 2 (Full Azerbaijani 12-key)
  const toggleLayoutVariant = () => {
    setLayoutVariant((prev) => (prev === 'gboard' ? 'az_full' : 'gboard'));
  };

  // Toggle Voice Recognition (Microphone icon)
  const toggleVoiceTyping = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Səsli yazma brauzerinizdə dəstəklənmir.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'az-AZ';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onKeyPress(transcript + ' ');
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleCharClick = (char: string) => {
    const finalChar = (isShift || isCapsLock) ? char.toUpperCase() : char.toLowerCase();
    onKeyPress(finalChar);
    
    // Auto-disable shift if not caps locked
    if (isShift && !isCapsLock) {
      setIsShift(false);
    }
  };

  const handleShiftClick = () => {
    if (!isShift && !isCapsLock) {
      setIsShift(true);
    } else if (isShift && !isCapsLock) {
      setIsCapsLock(true);
    } else {
      setIsShift(false);
      setIsCapsLock(false);
    }
  };

  // Backspace with repeat hold support
  const handleBackspaceStart = () => {
    onBackspace();
    backspaceTimerRef.current = setInterval(() => {
      onBackspace();
    }, 90);
  };

  const handleBackspaceEnd = () => {
    if (backspaceTimerRef.current) {
      clearInterval(backspaceTimerRef.current);
      backspaceTimerRef.current = null;
    }
  };

  // Long press handler for Row 1 superscripts (Gboard mode)
  const handleKeyTouchStart = (key: string, sup: string) => {
    longPressTimerRef.current = setTimeout(() => {
      onKeyPress(sup);
      longPressTimerRef.current = null;
    }, 350);
  };

  const handleKeyTouchEnd = (key: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      handleCharClick(key);
    }
  };

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.name === activeEmojiCat) || EMOJI_CATEGORIES[0];

  // Theme colors strictly based on the user's phone screenshot
  const isAzFull = layoutVariant === 'az_full';
  const bgColor = isAzFull 
    ? '#101217' 
    : (activeTheme === 'amoled' ? '#000000' : activeTheme === 'blue' ? '#141a24' : '#111217');
  const keyBgColor = isAzFull 
    ? '#222530' 
    : (activeTheme === 'amoled' ? '#16171d' : activeTheme === 'blue' ? '#222d3d' : '#24262f');
  const fnKeyBgColor = isAzFull 
    ? '#181921' 
    : (activeTheme === 'amoled' ? '#111216' : activeTheme === 'blue' ? '#1a2330' : '#1a1c23');

  return (
    <motion.div
      id="gboard-virtual-keyboard"
      initial={{ y: 260, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 260, opacity: 0 }}
      transition={{ type: 'spring', damping: 32, stiffness: 380 }}
      className="w-full select-none pt-0.5 pb-2.5 sm:pb-3 shadow-[0_-12px_35px_rgba(0,0,0,0.85)] z-40 relative shrink-0"
      style={{ backgroundColor: bgColor }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. GBOARD TOP ACTION TOOLBAR (Identical to phone screenshot) */}
      <div 
        id="gboard-toolbar"
        className="flex items-center justify-between px-3 h-10 border-b border-white/5"
      >
        <div className="flex items-center gap-4 sm:gap-6 text-[#d0d3d9]">
          {/* Shortcuts / 4-square Grid Icon */}
          <button
            id="gboard-grid-btn"
            type="button"
            onClick={() => {
              if (currentTab !== 'keyboard') setCurrentTab('keyboard');
            }}
            className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
            title="Funksiyalar"
          >
            <LayoutGrid className="w-4.5 h-4.5 text-[#d0d3d9]" />
          </button>

          {/* Stickers / Emoji Face Icon */}
          <button
            id="gboard-emoji-toolbar-btn"
            type="button"
            onClick={() => setCurrentTab(currentTab === 'emojis' ? 'keyboard' : 'emojis')}
            className={`p-1 rounded-full active:scale-90 transition-all cursor-pointer ${
              currentTab === 'emojis' ? 'text-[#8ab4f8] bg-white/10' : 'hover:bg-white/10 text-[#d0d3d9]'
            }`}
            title="Stikerlər və Emojilər"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* GIF Text Badge Button */}
          <button
            id="gboard-gif-btn"
            type="button"
            onClick={() => setCurrentTab(currentTab === 'gifs' ? 'keyboard' : 'gifs')}
            className={`px-1.5 py-0.2 rounded font-sans text-[11px] font-bold tracking-wider border active:scale-90 transition-all cursor-pointer ${
              currentTab === 'gifs'
                ? 'bg-[#8ab4f8] text-[#13203c] border-[#8ab4f8]'
                : 'text-[#d0d3d9] border-white/20 hover:bg-white/10'
            }`}
            title="GIF Animasiyalar"
          >
            GIF
          </button>

          {/* Settings Gear Icon */}
          <button
            id="gboard-settings-btn"
            type="button"
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
            title="Tənzimləmələr"
          >
            <Settings className="w-4.5 h-4.5 text-[#d0d3d9]" />
          </button>

          {/* Toggle Layout / Language Icon (Gboard AZ • TR <-> Full AZ) */}
          <button
            id="gboard-translate-btn"
            type="button"
            onClick={toggleLayoutVariant}
            className={`p-1 rounded-full active:scale-90 transition-transform cursor-pointer ${
              layoutVariant === 'az_full' ? 'text-[#00a884] bg-white/10' : 'hover:bg-white/10 text-[#d0d3d9]'
            }`}
            title={layoutVariant === 'gboard' ? 'Azərbaycan Tam Düzümünə keç' : 'Gboard AZ•TR Düzümünə keç'}
          >
            <Languages className="w-4.5 h-4.5" />
          </button>

          {/* Themes Palette Icon */}
          <button
            id="gboard-palette-btn"
            type="button"
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-1 rounded-full hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
            title="Temalar"
          >
            <Palette className="w-4.5 h-4.5 text-[#d0d3d9]" />
          </button>
        </div>

        {/* Far Right: Microphone (Voice Typing) & Down Caret */}
        <div className="flex items-center gap-1">
          <button
            id="gboard-mic-btn"
            type="button"
            onClick={toggleVoiceTyping}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'hover:bg-white/10 text-[#d0d3d9]'
            }`}
            title="Səslə yazma"
          >
            <Mic className="w-4.5 h-4.5" />
          </button>

          <button
            id="gboard-close-btn"
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Klaviaturanı bağla"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Theme Picker Dropdown */}
      {showThemePicker && (
        <div className="absolute top-10 left-3 right-3 bg-[#1d1f26] border border-zinc-700/80 rounded-xl p-2 z-50 flex items-center justify-between gap-2 shadow-2xl">
          <span className="text-xs font-sans text-zinc-300">Klaviatura Mövzusu:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setActiveTheme('dark'); setShowThemePicker(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                activeTheme === 'dark' ? 'bg-[#8ab4f8] text-[#0f1d38] font-bold' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Klassik Qara
            </button>
            <button
              type="button"
              onClick={() => { setActiveTheme('amoled'); setShowThemePicker(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                activeTheme === 'amoled' ? 'bg-[#8ab4f8] text-[#0f1d38] font-bold' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Amoled
            </button>
            <button
              type="button"
              onClick={() => { setActiveTheme('blue'); setShowThemePicker(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                activeTheme === 'blue' ? 'bg-[#8ab4f8] text-[#0f1d38] font-bold' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Gecə Mavisi
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowThemePicker(false)}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. EMOJI DRAWER TAB */}
      {currentTab === 'emojis' ? (
        <div className="px-2 pt-1 pb-1">
          {/* Emoji Category icons */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 mb-1 border-b border-zinc-800/60">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveEmojiCat(cat.name)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-sans whitespace-nowrap cursor-pointer transition-all ${
                  activeEmojiCat === cat.name
                    ? 'bg-[#8ab4f8] text-[#121e36] font-bold'
                    : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <div className="h-[175px] overflow-y-auto grid grid-cols-7 sm:grid-cols-9 gap-1 p-1">
            {currentCategory.emojis.map((em, idx) => (
              <button
                key={`${em}-${idx}`}
                type="button"
                onClick={() => onKeyPress(em)}
                className="h-9 flex items-center justify-center text-xl rounded-lg hover:bg-zinc-700/80 active:scale-125 transition-transform cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>

          {/* Bottom Bar: Switch back to ABC, Space, Backspace, Enter */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-800/80 px-1">
            <button
              type="button"
              onClick={() => setCurrentTab('keyboard')}
              className="h-10 px-4 rounded-[7px] text-white font-sans text-xs font-bold flex items-center justify-center cursor-pointer active:scale-95"
              style={{ backgroundColor: fnKeyBgColor }}
            >
              ABC
            </button>
            <button
              type="button"
              onClick={() => onKeyPress(' ')}
              className="h-10 flex-1 rounded-[7px] text-zinc-400 text-xs font-sans flex items-center justify-center cursor-pointer active:scale-95"
              style={{ backgroundColor: keyBgColor }}
              aria-label="Boşluq"
            >
              {isAzFull ? 'boşluq' : 'AZ • TR'}
            </button>
            <button
              type="button"
              onClick={onBackspace}
              className="h-10 w-12 rounded-[7px] text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95"
              style={{ backgroundColor: fnKeyBgColor }}
              title="Sil"
            >
              <Delete className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={onEnter}
              className={`h-10 px-4 rounded-[16px] flex items-center justify-center cursor-pointer active:scale-95 shadow-md ${
                isAzFull ? 'bg-[#00a884] text-white' : 'bg-[#9abdf9] text-[#0e1b30]'
              }`}
              title="Göndər"
            >
              <CornerDownLeft className="w-4.5 h-4.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : currentTab === 'gifs' ? (
        /* GIF SELECTOR TAB */
        <div className="px-2 pt-1 pb-1">
          <div className="h-[175px] overflow-y-auto grid grid-cols-3 gap-1.5 p-1">
            {[
              'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=300&q=80',
              'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=300&q=80',
              'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=300&q=80',
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80',
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80'
            ].map((imgUrl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onKeyPress(`[GIF:${i + 1}] `);
                  setCurrentTab('keyboard');
                }}
                className="h-20 rounded-lg overflow-hidden border border-zinc-700/80 hover:border-[#8ab4f8] transition-colors cursor-pointer relative group"
              >
                <img src={imgUrl} alt="GIF reaction" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.2 rounded text-[9px] font-mono-tech text-white">
                  GIF
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80 px-1">
            <button
              type="button"
              onClick={() => setCurrentTab('keyboard')}
              className="h-10 px-4 rounded-[7px] text-white font-sans text-xs font-bold flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: fnKeyBgColor }}
            >
              ABC
            </button>
            <div className="flex-1 text-center text-xs text-zinc-400 font-sans">
              GIF Kolleksiyası
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-[7px] text-zinc-300 font-sans text-xs flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: fnKeyBgColor }}
            >
              Bağla
            </button>
          </div>
        </div>
      ) : (
        /* 3. KEYBOARD MATRIX - EXACT PROPORTIONS AS PHONE SCREENSHOT */
        <div className="px-1 py-1 space-y-1">
          {keyLayout === 'alpha' ? (
            layoutVariant === 'gboard' ? (
              /* ================== LAYOUT 1: GBOARD (AZ • TR) ================== */
              <>
                {/* ROW 1: Q, Ə, E, R, T, Y, U, I, O, P (with 1..0 superscripts) */}
                <div className="flex items-center justify-center gap-1">
                  {ROW_1_GBOARD.map(({ key, sup }) => (
                    <button
                      key={key}
                      type="button"
                      onTouchStart={() => handleKeyTouchStart(key, sup)}
                      onTouchEnd={() => handleKeyTouchEnd(key)}
                      onClick={() => handleCharClick(key)}
                      className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex flex-col items-center justify-center relative active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                      style={{ backgroundColor: keyBgColor }}
                    >
                      <span className="absolute top-0.5 right-1 text-[9px] sm:text-[10px] text-zinc-400 font-sans leading-none">
                        {sup}
                      </span>
                      <span className="mt-1">
                        {(isShift || isCapsLock) ? key.toUpperCase() : key.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>

                {/* ROW 2: A, S, D, F, G, H, J, K, L */}
                <div className="flex items-center justify-center gap-1 px-[4%]">
                  {ROW_2_GBOARD.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleCharClick(key)}
                      className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                      style={{ backgroundColor: keyBgColor }}
                    >
                      {(isShift || isCapsLock) ? key.toUpperCase() : key.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* ROW 3: Shift, Z, X, C, V, B, N, M, Backspace */}
                <div className="flex items-center justify-center gap-1">
                  {/* Shift Key */}
                  <button
                    id="gboard-shift-btn"
                    type="button"
                    onClick={handleShiftClick}
                    className={`w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isCapsLock
                        ? 'bg-[#8ab4f8] text-[#13203c]'
                        : isShift
                        ? 'bg-white/25 text-white'
                        : 'text-zinc-300 hover:bg-white/10'
                    }`}
                    style={{ backgroundColor: isCapsLock ? '#8ab4f8' : isShift ? '#383a42' : fnKeyBgColor }}
                    title="Shift"
                  >
                    <ArrowUp className={`w-4.5 h-4.5 ${isShift || isCapsLock ? 'stroke-[3]' : 'stroke-2'}`} />
                  </button>

                  <div className="flex items-center justify-center gap-1 flex-1">
                    {ROW_3_GBOARD.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCharClick(key)}
                        className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                        style={{ backgroundColor: keyBgColor }}
                      >
                        {(isShift || isCapsLock) ? key.toUpperCase() : key.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Backspace Key */}
                  <button
                    id="gboard-backspace-btn"
                    type="button"
                    onMouseDown={handleBackspaceStart}
                    onMouseUp={handleBackspaceEnd}
                    onMouseLeave={handleBackspaceEnd}
                    onTouchStart={handleBackspaceStart}
                    onTouchEnd={handleBackspaceEnd}
                    onClick={onBackspace}
                    className="w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] text-zinc-300 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95 active:bg-white/20"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Sil"
                  >
                    <Delete className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* ROW 4: ?123, ☺/,, 🌐, Spacebar "AZ • TR", ., Light Blue Enter */}
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  <button
                    id="gboard-sym-toggle-btn"
                    type="button"
                    onClick={() => setKeyLayout('num')}
                    className="w-[13.5%] sm:w-[12.5%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-xs sm:text-sm font-semibold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                  >
                    ?123
                  </button>

                  {/* Emoji & Comma Key */}
                  <button
                    id="gboard-comma-emoji-btn"
                    type="button"
                    onClick={() => handleCharClick(',')}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCurrentTab('emojis');
                    }}
                    className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans flex flex-col items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Vergül və Emoji"
                  >
                    <Smile className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-bold leading-none mt-0.5 text-zinc-300">,</span>
                  </button>

                  {/* Globe Button: Toggles to Layout 2 (Photo 2) */}
                  <button
                    id="gboard-globe-btn"
                    type="button"
                    onClick={toggleLayoutVariant}
                    className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95 hover:border-zinc-500 border border-transparent"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Klaviatura düzümünü dəyiş"
                  >
                    <Globe className="w-4.5 h-4.5" />
                  </button>

                  {/* Spacebar with "AZ • TR" (Exact text from phone screenshot) */}
                  <button
                    id="gboard-spacebar-btn"
                    type="button"
                    onClick={() => onKeyPress(' ')}
                    className="flex-1 h-11 sm:h-12 rounded-[6px] text-[#8e929b] font-sans text-xs font-normal flex items-center justify-center cursor-pointer transition-all shadow-xs active:bg-white/20 active:scale-[0.99]"
                    style={{ backgroundColor: keyBgColor }}
                    aria-label="Boşluq"
                  >
                    AZ • TR
                  </button>

                  {/* Period (.) */}
                  <button
                    id="gboard-period-btn"
                    type="button"
                    onClick={() => handleCharClick('.')}
                    className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                  >
                    .
                  </button>

                  {/* Light Blue Pill Enter Key (↵) matching phone screenshot */}
                  <button
                    id="gboard-enter-btn"
                    type="button"
                    onClick={onEnter}
                    className="w-[14%] sm:w-[13.5%] h-11 sm:h-12 rounded-[16px] sm:rounded-[18px] bg-[#9abdf9] hover:bg-[#8bb0f3] active:bg-[#7fa7ed] text-[#0e1b30] flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md"
                    title="Göndər"
                  >
                    <CornerDownLeft className="w-5 h-5 stroke-[2.8]" />
                  </button>
                </div>
              </>
            ) : (
              /* ================== LAYOUT 2: FULL AZERBAIJANI (PHOTO 2) ================== */
              <>
                {/* ROW 1 (12 keys): q, ü, e, r, t, y, u, i, o, p, ö, ğ */}
                <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                  {ROW_1_AZ_FULL.map((key) => {
                    const char = (isShift || isCapsLock) ? key.toUpperCase() : key.toLowerCase();
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCharClick(key)}
                        className="flex-1 h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-white font-sans text-base sm:text-lg font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                        style={{ backgroundColor: keyBgColor }}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>

                {/* ROW 2 (11 keys): a, s, d, f, g, h, j, k, l, ı, ə */}
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 px-[1.5%]">
                  {ROW_2_AZ_FULL.map((key) => {
                    const char = (isShift || isCapsLock) ? key.toUpperCase() : key.toLowerCase();
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCharClick(key)}
                        className="flex-1 h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-white font-sans text-base sm:text-lg font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                        style={{ backgroundColor: keyBgColor }}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>

                {/* ROW 3 (11 keys): Shift (↑), z, x, c, v, b, n, m, ç, ş, Backspace (⌫) */}
                <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                  {/* Shift key (↑) */}
                  <button
                    type="button"
                    onClick={handleShiftClick}
                    className={`w-[10.5%] sm:w-[10%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isCapsLock
                        ? 'bg-[#00a884] text-white'
                        : isShift
                        ? 'bg-white/25 text-white'
                        : 'text-zinc-300 hover:bg-white/10'
                    }`}
                    style={{ backgroundColor: isCapsLock ? '#00a884' : isShift ? '#373a48' : fnKeyBgColor }}
                    title="Shift"
                  >
                    <ArrowUp className={`w-4 h-4 ${isShift || isCapsLock ? 'stroke-[3]' : 'stroke-2'}`} />
                  </button>

                  <div className="flex items-center justify-center gap-0.5 sm:gap-1 flex-1">
                    {ROW_3_AZ_FULL.map((key) => {
                      const char = (isShift || isCapsLock) ? key.toUpperCase() : key.toLowerCase();
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleCharClick(key)}
                          className="flex-1 h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-white font-sans text-base sm:text-lg font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                          style={{ backgroundColor: keyBgColor }}
                        >
                          {char}
                        </button>
                      );
                    })}
                  </div>

                  {/* Backspace key (⌫) */}
                  <button
                    type="button"
                    onMouseDown={handleBackspaceStart}
                    onMouseUp={handleBackspaceEnd}
                    onMouseLeave={handleBackspaceEnd}
                    onTouchStart={handleBackspaceStart}
                    onTouchEnd={handleBackspaceEnd}
                    onClick={onBackspace}
                    className="w-[10.5%] sm:w-[10%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-zinc-300 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95 active:bg-white/20"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Sil"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>

                {/* ROW 4: ?123, Green ☺, 🌐, Spacebar "boşluq", ., Green Enter (↵) */}
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  {/* ?123 */}
                  <button
                    type="button"
                    onClick={() => setKeyLayout('num')}
                    className="w-[13%] sm:w-[12%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-white font-sans text-xs sm:text-sm font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                  >
                    ?123
                  </button>

                  {/* Green Circular Smiley ☺ */}
                  <button
                    type="button"
                    onClick={() => setCurrentTab('emojis')}
                    className="w-[9%] sm:w-[8.5%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-[#00b075] hover:text-[#00c583] flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Emojilər"
                  >
                    <Smile className="w-4.5 h-4.5 stroke-[2.2]" />
                  </button>

                  {/* Globe button */}
                  <button
                    type="button"
                    onClick={toggleLayoutVariant}
                    className="w-[9%] sm:w-[8.5%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-zinc-200 border border-zinc-600/80 hover:border-zinc-400 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                    title="Gboard düzümünə qayıt"
                  >
                    <Globe className="w-4 h-4" />
                  </button>

                  {/* Spacebar with "boşluq" label */}
                  <button
                    type="button"
                    onClick={() => onKeyPress(' ')}
                    className="flex-1 h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-[#8e929b] font-sans text-xs font-normal flex items-center justify-center cursor-pointer transition-all shadow-xs active:bg-white/20 active:scale-[0.99]"
                    style={{ backgroundColor: keyBgColor }}
                    aria-label="Boşluq"
                  >
                    boşluq
                  </button>

                  {/* Period (.) */}
                  <button
                    type="button"
                    onClick={() => handleCharClick('.')}
                    className="w-[9%] sm:w-[8.5%] h-10 sm:h-11 rounded-[5px] sm:rounded-[6px] text-white font-sans text-lg font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                    style={{ backgroundColor: fnKeyBgColor }}
                  >
                    .
                  </button>

                  {/* Emerald Green Enter Key (↵) */}
                  <button
                    type="button"
                    onClick={onEnter}
                    className="w-[14%] sm:w-[13%] h-10 sm:h-11 rounded-[8px] bg-[#00a884] hover:bg-[#009b7a] active:bg-[#008f70] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md"
                    title="Göndər"
                  >
                    <CornerDownLeft className="w-4.5 h-4.5 stroke-[2.5]" />
                  </button>
                </div>
              </>
            )
          ) : keyLayout === 'num' ? (
            /* NUMERIC / SYMBOL KEYBOARD */
            <>
              {/* Numbers 1..0 */}
              <div className="flex items-center justify-center gap-1">
                {ROW_1_NUM.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleCharClick(num)}
                    className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                    style={{ backgroundColor: keyBgColor }}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Row 2 Symbols */}
              <div className="flex items-center justify-center gap-1 px-[3%]">
                {ROW_2_SYM.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleCharClick(sym)}
                    className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                    style={{ backgroundColor: keyBgColor }}
                  >
                    {sym}
                  </button>
                ))}
              </div>

              {/* Row 3 Symbols with 1/2 switch and backspace */}
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setKeyLayout('sym')}
                  className="w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] text-zinc-300 font-sans text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  =\&lt;
                </button>

                <div className="flex items-center justify-center gap-1 flex-1">
                  {ROW_3_SYM.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleCharClick(sym)}
                      className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                      style={{ backgroundColor: keyBgColor }}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onBackspace}
                  className="w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] text-zinc-300 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  <Delete className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Row 4 in Numeric mode */}
              <div className="flex items-center justify-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setKeyLayout('alpha')}
                  className="w-[13.5%] sm:w-[12.5%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-xs sm:text-sm font-semibold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  ABC
                </button>
                <button
                  type="button"
                  onClick={() => handleCharClick(',')}
                  className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={() => onKeyPress(' ')}
                  className="flex-1 h-11 sm:h-12 rounded-[6px] text-zinc-400 font-sans text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs active:bg-white/20 active:scale-[0.99]"
                  style={{ backgroundColor: keyBgColor }}
                  aria-label="Boşluq"
                >
                  {isAzFull ? 'boşluq' : 'AZ • TR'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCharClick('.')}
                  className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={onEnter}
                  className={`w-[14%] sm:w-[13.5%] h-11 sm:h-12 rounded-[16px] sm:rounded-[18px] flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md ${
                    isAzFull ? 'bg-[#00a884] text-white' : 'bg-[#9abdf9] text-[#0e1b30]'
                  }`}
                  title="Göndər"
                >
                  <CornerDownLeft className="w-5 h-5 stroke-[2.8]" />
                </button>
              </div>
            </>
          ) : (
            /* EXTRA SYMBOLS KEYBOARD */
            <>
              <div className="flex items-center justify-center gap-1">
                {ROW_1_EXTRA_SYM.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleCharClick(sym)}
                    className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                    style={{ backgroundColor: keyBgColor }}
                  >
                    {sym}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1 px-[3%]">
                {ROW_2_EXTRA_SYM.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleCharClick(sym)}
                    className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                    style={{ backgroundColor: keyBgColor }}
                  >
                    {sym}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setKeyLayout('num')}
                  className="w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] text-zinc-300 font-sans text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  ?123
                </button>

                <div className="flex items-center justify-center gap-1 flex-1">
                  {ROW_3_EXTRA_SYM.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleCharClick(sym)}
                      className="flex-1 h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-normal flex items-center justify-center active:bg-white/20 active:scale-95 transition-all shadow-xs cursor-pointer select-none"
                      style={{ backgroundColor: keyBgColor }}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onBackspace}
                  className="w-[14%] sm:w-[13%] h-11 sm:h-12 rounded-[6px] text-zinc-300 flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  <Delete className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Row 4 in Extra Symbols mode */}
              <div className="flex items-center justify-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setKeyLayout('alpha')}
                  className="w-[13.5%] sm:w-[12.5%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-xs sm:text-sm font-semibold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  ABC
                </button>
                <button
                  type="button"
                  onClick={() => handleCharClick(',')}
                  className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={() => onKeyPress(' ')}
                  className="flex-1 h-11 sm:h-12 rounded-[6px] text-zinc-400 font-sans text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs active:bg-white/20 active:scale-[0.99]"
                  style={{ backgroundColor: keyBgColor }}
                  aria-label="Boşluq"
                >
                  {isAzFull ? 'boşluq' : 'AZ • TR'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCharClick('.')}
                  className="w-[9.5%] sm:w-[9%] h-11 sm:h-12 rounded-[6px] text-white font-sans text-lg sm:text-xl font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs active:scale-95"
                  style={{ backgroundColor: fnKeyBgColor }}
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={onEnter}
                  className={`w-[14%] sm:w-[13.5%] h-11 sm:h-12 rounded-[16px] sm:rounded-[18px] flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-md ${
                    isAzFull ? 'bg-[#00a884] text-white' : 'bg-[#9abdf9] text-[#0e1b30]'
                  }`}
                  title="Göndər"
                >
                  <CornerDownLeft className="w-5 h-5 stroke-[2.8]" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
