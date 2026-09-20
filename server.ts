import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Interface definition for DB storage
interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: number;
  lastSeen: number;
  avatar?: string;
  statusMessage?: string;
}

interface StoredMessage {
  id: string;
  sender: string;
  recipient: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  content: string;
  mediaUrl?: string;
  duration?: number;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string>;
}

interface StoredCallLog {
  id: string;
  caller: string;
  recipient: string;
  callType: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined';
  duration?: number;
  timestamp: number;
}

interface DbSchema {
  users: Record<string, StoredUser>;
  messages: StoredMessage[];
  calls: StoredCallLog[];
}

function ensureDbFile(): DbSchema {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData: DbSchema = {
      users: {
        khabib: {
          id: 'user_khabib',
          username: 'khabib',
          passwordHash: '200911',
          isAdmin: true,
          isBlocked: false,
          createdAt: Date.now(),
          lastSeen: Date.now()
        },
        elvin: {
          id: 'user_elvin',
          username: 'elvin',
          passwordHash: 'password123',
          isAdmin: false,
          isBlocked: false,
          createdAt: Date.now(),
          lastSeen: Date.now()
        },
        hebib: {
          id: 'user_hebib',
          username: 'hebib',
          passwordHash: '2009',
          isAdmin: false,
          isBlocked: false,
          createdAt: Date.now(),
          lastSeen: Date.now()
        }
      },
      messages: [],
      calls: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.calls) parsed.calls = [];
    return parsed;
  } catch {
    return { users: {}, messages: [], calls: [] };
  }
}

function saveDb(data: DbSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 });

  // Map connected usernames to active WebSockets
  const clients = new Map<string, Set<WebSocket>>();

  const sendToUser = (username: string, payload: any) => {
    const sockets = clients.get(username.toLowerCase());
    if (sockets) {
      const msg = JSON.stringify(payload);
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  };

  const broadcastUserStatus = (username: string, isOnline: boolean) => {
    const payload = JSON.stringify({
      type: 'user_status',
      username,
      isOnline
    });
    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  };

  const getOnlineUsernames = (): string[] => {
    const active: string[] = [];
    for (const [uname, sockets] of clients.entries()) {
      let anyOpen = false;
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          anyOpen = true;
          break;
        }
      }
      if (anyOpen) active.push(uname);
    }
    return active;
  };

  // --- REST API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'İstifadəçi adı və parol tələb olunur' });
    }

    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'İstifadəçi adı və ya parol yanlışdır' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Hesabınız admin tərəfindən bloklanıb' });
    }

    user.lastSeen = Date.now();
    saveDb(db);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        avatar: user.avatar,
        statusMessage: user.statusMessage
      }
    });
  });

  // Register
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    if (!cleanUsername || !password) {
      return res.status(400).json({ error: 'Bütün xanaları doldurun' });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'İstifadəçi adı ən az 3 simvol olmalıdır' });
    }

    const db = ensureDbFile();
    const key = cleanUsername.toLowerCase();

    if (db.users[key]) {
      return res.status(409).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }

    const isKhabib = key === 'khabib';
    const newUser: StoredUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: cleanUsername,
      passwordHash: password,
      isAdmin: isKhabib,
      isBlocked: false,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      avatar: '',
      statusMessage: 'Khami tətbiqindən istifadə edirəm'
    };

    db.users[key] = newUser;
    saveDb(db);

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
        isBlocked: newUser.isBlocked,
        createdAt: newUser.createdAt,
        lastSeen: newUser.lastSeen,
        avatar: newUser.avatar,
        statusMessage: newUser.statusMessage
      }
    });
  });

  // Update Profile (Avatar & Status)
  app.post('/api/user/profile', (req, res) => {
    const { username, avatar, statusMessage } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'İstifadəçi adı tələb olunur' });
    }

    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }
    if (statusMessage !== undefined) {
      user.statusMessage = statusMessage.slice(0, 120);
    }

    saveDb(db);

    // Broadcast profile change to all clients so contacts immediately see the new avatar & status
    const broadcastPayload = JSON.stringify({
      type: 'profile_updated',
      username: user.username,
      avatar: user.avatar,
      statusMessage: user.statusMessage
    });

    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(broadcastPayload);
        }
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        avatar: user.avatar,
        statusMessage: user.statusMessage
      }
    });
  });

  // Get user details
  app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    res.json({
      user: {
        username: user.username,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        isOnline: getOnlineUsernames().includes(key)
      }
    });
  });

  // Check user existence (for confidential chat start)
  app.get('/api/user-check/:username', (req, res) => {
    const { username } = req.params;
    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ exists: false, error: 'İstifadəçi tapılmadı' });
    }

    res.json({
      exists: true,
      username: user.username,
      isBlocked: user.isBlocked,
      avatar: user.avatar,
      statusMessage: user.statusMessage
    });
  });

  // Get conversations for a user
  app.get('/api/conversations/:username', (req, res) => {
    const { username } = req.params;
    const cleanUser = username.toLowerCase();
    const db = ensureDbFile();

    // Group messages by conversation peer
    const conversationMap = new Map<string, { lastMessage: StoredMessage; unreadCount: number }>();

    for (const msg of db.messages) {
      const sender = msg.sender.toLowerCase();
      const recipient = msg.recipient.toLowerCase();

      if (sender !== cleanUser && recipient !== cleanUser) {
        continue;
      }

      const peer = sender === cleanUser ? msg.recipient : msg.sender;
      const peerKey = peer.toLowerCase();

      let conv = conversationMap.get(peerKey);
      if (!conv) {
        conv = { lastMessage: msg, unreadCount: 0 };
        conversationMap.set(peerKey, conv);
      } else {
        if (msg.timestamp > conv.lastMessage.timestamp) {
          conv.lastMessage = msg;
        }
      }

      if (recipient === cleanUser && msg.status !== 'read') {
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationMap.entries()).map(([peerKey, data]) => {
      const peerUser = db.users[peerKey];
      const originalUser = peerUser?.username || peerKey;
      return {
        user: originalUser,
        avatar: peerUser?.avatar,
        statusMessage: peerUser?.statusMessage,
        lastMessage: data.lastMessage,
        unreadCount: data.unreadCount
      };
    });

    // Sort by most recent message descending
    conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

    res.json({ conversations });
  });

  // Get messages between two users
  app.get('/api/messages/:user1/:user2', (req, res) => {
    const u1 = req.params.user1.toLowerCase();
    const u2 = req.params.user2.toLowerCase();
    const db = ensureDbFile();

    const conversationMessages = db.messages.filter((m) => {
      const s = m.sender.toLowerCase();
      const r = m.recipient.toLowerCase();
      return (s === u1 && r === u2) || (s === u2 && r === u1);
    });

    // Mark messages sent to u1 as read
    let updated = false;
    for (const m of conversationMessages) {
      if (m.recipient.toLowerCase() === u1 && m.status !== 'read') {
        m.status = 'read';
        updated = true;
      }
    }

    if (updated) {
      saveDb(db);
      sendToUser(u2, {
        type: 'messages_read',
        reader: req.params.user1
      });
    }

    res.json({ messages: conversationMessages });
  });

  // Delete / Clear conversation
  app.delete('/api/conversation/:user1/:user2', (req, res) => {
    const u1 = req.params.user1.toLowerCase();
    const u2 = req.params.user2.toLowerCase();
    const db = ensureDbFile();

    db.messages = db.messages.filter((m) => {
      const s = m.sender.toLowerCase();
      const r = m.recipient.toLowerCase();
      return !((s === u1 && r === u2) || (s === u2 && r === u1));
    });

    saveDb(db);

    // Notify users in real-time
    sendToUser(u1, { type: 'conversation_deleted', peer: req.params.user2 });
    sendToUser(u2, { type: 'conversation_deleted', peer: req.params.user1 });

    res.json({ success: true });
  });

  // Delete single message
  app.delete('/api/message/:id', (req, res) => {
    const { id } = req.params;
    const db = ensureDbFile();
    const idx = db.messages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const deleted = db.messages[idx];
      db.messages.splice(idx, 1);
      saveDb(db);

      sendToUser(deleted.sender, { type: 'message_deleted', messageId: id, peer: deleted.recipient });
      sendToUser(deleted.recipient, { type: 'message_deleted', messageId: id, peer: deleted.sender });
    }
    res.json({ success: true });
  });

  // Call Logs: Get calls for a user
  app.get('/api/calls/:username', (req, res) => {
    const user = req.params.username.toLowerCase();
    const db = ensureDbFile();
    const userCalls = (db.calls || []).filter(
      (c) => c.caller.toLowerCase() === user || c.recipient.toLowerCase() === user
    ).sort((a, b) => b.timestamp - a.timestamp);
    res.json(userCalls);
  });

  // Call Logs: Create or update call log
  app.post('/api/calls', (req, res) => {
    const { id, caller, recipient, callType, status, duration, timestamp } = req.body;
    if (!caller || !recipient) {
      return res.status(400).json({ error: 'Caller and recipient required' });
    }
    const db = ensureDbFile();
    if (!db.calls) db.calls = [];

    const callId = id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const existingIdx = db.calls.findIndex((c) => c.id === callId);
    const callRecord: StoredCallLog = {
      id: callId,
      caller,
      recipient,
      callType: callType || 'voice',
      status: status || 'completed',
      duration: duration !== undefined ? duration : 0,
      timestamp: timestamp || Date.now()
    };

    if (existingIdx !== -1) {
      db.calls[existingIdx] = { ...db.calls[existingIdx], ...callRecord };
    } else {
      db.calls.unshift(callRecord);
    }
    saveDb(db);

    sendToUser(caller, { type: 'call_log_updated', call: callRecord });
    sendToUser(recipient, { type: 'call_log_updated', call: callRecord });

    res.json(callRecord);
  });

  // Call Logs: Delete single call log
  app.delete('/api/calls/:id', (req, res) => {
    const { id } = req.params;
    const db = ensureDbFile();
    if (db.calls) {
      const idx = db.calls.findIndex((c) => c.id === id);
      if (idx !== -1) {
        const deleted = db.calls[idx];
        db.calls.splice(idx, 1);
        saveDb(db);
        sendToUser(deleted.caller, { type: 'call_log_updated' });
        sendToUser(deleted.recipient, { type: 'call_log_updated' });
      }
    }
    res.json({ success: true });
  });

  // Call Logs: Clear all calls for a user
  app.delete('/api/calls/clear/:username', (req, res) => {
    const user = req.params.username.toLowerCase();
    const db = ensureDbFile();
    if (db.calls) {
      db.calls = db.calls.filter(
        (c) => c.caller.toLowerCase() !== user && c.recipient.toLowerCase() !== user
      );
      saveDb(db);
      sendToUser(user, { type: 'call_log_updated' });
    }
    res.json({ success: true });
  });

  // Admin: Get all users
  app.get('/api/admin/users', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'Yalnız khabib istifadəçisi daxil ola bilər' });
    }

    const db = ensureDbFile();
    const onlineList = getOnlineUsernames();

    const usersList = Object.values(db.users).map((u) => ({
      id: u.id,
      username: u.username,
      isAdmin: u.isAdmin,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt,
      lastSeen: u.lastSeen,
      avatar: u.avatar,
      statusMessage: u.statusMessage,
      isOnline: onlineList.includes(u.username.toLowerCase())
    }));

    res.json({ users: usersList });
  });

  // Admin: Toggle block user
  app.post('/api/admin/block-toggle', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'İcazə verilmədi' });
    }

    const { targetUsername, block } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: 'İstifadəçi adı qeyd edilməyib' });
    }
    if (targetUsername.toLowerCase() === 'khabib') {
      return res.status(400).json({ error: 'Admin hesabı bloklana bilməz' });
    }

    const db = ensureDbFile();
    const user = db.users[targetUsername.toLowerCase()];
    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    user.isBlocked = !!block;
    saveDb(db);

    if (user.isBlocked) {
      sendToUser(targetUsername, { type: 'blocked_by_admin' });
      const sockets = clients.get(targetUsername.toLowerCase());
      if (sockets) {
        for (const ws of sockets) {
          ws.close();
        }
      }
    }

    res.json({ success: true, isBlocked: user.isBlocked });
  });

  // Admin: Clear all messages in all chats
  app.post('/api/admin/clear-all-messages', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'Yalnız khabib istifadəçisi bu əməliyyatı icra edə bilər' });
    }

    const db = ensureDbFile();
    db.messages = [];
    saveDb(db);

    // Broadcast to all connected clients
    const payload = JSON.stringify({
      type: 'all_messages_cleared'
    });

    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }

    res.json({ success: true, message: 'Bütün çat mesajları uğurla təmizləndi' });
  });

  // --- WEBSOCKET REAL-TIME DISPATCHER ---
  wss.on('connection', (ws: WebSocket) => {
    let authUser: string | null = null;

    ws.on('message', (messageRaw: string) => {
      try {
        const data = JSON.parse(messageRaw);
        switch (data.type) {
          case 'auth': {
            const username = (data.username || '').trim();
            if (!username) return;
            const userKey = username.toLowerCase();
            authUser = userKey;

            if (!clients.has(userKey)) {
              clients.set(userKey, new Set());
            }
            clients.get(userKey)!.add(ws);

            // Update user's lastSeen in DB
            const db = ensureDbFile();
            if (db.users[userKey]) {
              db.users[userKey].lastSeen = Date.now();
              saveDb(db);
            }

            // Send online users list to connecting socket
            ws.send(JSON.stringify({
              type: 'online_users',
              users: getOnlineUsernames()
            }));

            // Notify everyone of user online
            broadcastUserStatus(username, true);
            break;
          }

          case 'send_message': {
            const msg: StoredMessage = data.message;
            if (!msg || !msg.sender || !msg.recipient) return;

            const db = ensureDbFile();
            const recipientSockets = clients.get(msg.recipient.toLowerCase());
            const isRecipientOnline = recipientSockets && recipientSockets.size > 0;

            const storedMsg: StoredMessage = {
              ...msg,
              status: isRecipientOnline ? 'delivered' : 'sent',
              timestamp: msg.timestamp || Date.now()
            };

            // If an existing placeholder exists with same id, avoid duplicate
            const existingIdx = db.messages.findIndex((m) => m.id === storedMsg.id);
            if (existingIdx !== -1) {
              db.messages[existingIdx] = storedMsg;
            } else {
              db.messages.push(storedMsg);
            }
            saveDb(db);

            // Forward to recipient
            sendToUser(msg.recipient, {
              type: 'chat_message',
              message: storedMsg
            });

            // Send delivery acknowledgment back to sender
            if (isRecipientOnline) {
              sendToUser(msg.sender, {
                type: 'message_delivered',
                messageId: storedMsg.id
              });
            }
            break;
          }

          case 'react_message': {
            const { messageId, username, targetUser, emoji } = data;
            const db = ensureDbFile();
            const targetMsg = db.messages.find((m) => m.id === messageId);
            if (targetMsg) {
              if (!targetMsg.reactions) targetMsg.reactions = {};
              targetMsg.reactions[username] = emoji;
              saveDb(db);
            }
            sendToUser(targetUser, {
              type: 'message_reaction',
              messageId,
              username,
              emoji
            });
            break;
          }

          case 'mark_read': {
            const { sender, targetUser } = data;
            const db = ensureDbFile();
            let changed = false;
            for (const m of db.messages) {
              if (
                m.sender.toLowerCase() === targetUser.toLowerCase() &&
                m.recipient.toLowerCase() === sender.toLowerCase() &&
                m.status !== 'read'
              ) {
                m.status = 'read';
                changed = true;
              }
            }
            if (changed) {
              saveDb(db);
              sendToUser(targetUser, {
                type: 'messages_read',
                reader: sender
              });
            }
            break;
          }

          case 'call_signal': {
            const { targetUser } = data;
            if (targetUser) {
              sendToUser(targetUser, {
                type: 'call_signal',
                from: authUser,
                ...data
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn('WS Message Error:', err);
      }
    });

    ws.on('close', () => {
      const userKey = authUser;
      if (userKey) {
        const userSockets = clients.get(userKey);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            clients.delete(userKey);
            // Update last seen in DB
            const db = ensureDbFile();
            if (db.users[userKey]) {
              db.users[userKey].lastSeen = Date.now();
              saveDb(db);
            }
            broadcastUserStatus(userKey, false);
          }
        }
      }
    });
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khami Studios Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
