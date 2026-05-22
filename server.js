const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const crypto = require('crypto');
const url = require('url');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// === ПАПКИ ДЛЯ ДАННЫХ ===
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// === ХРАНИЛИЩЕ ===
function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('Ошибка чтения', file, e);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Ошибка записи', file, e);
  }
}

let users = loadJSON(USERS_FILE, []);
let chats = loadJSON(CHATS_FILE, []);

function persistUsers() { saveJSON(USERS_FILE, users); }
function persistChats() { saveJSON(CHATS_FILE, chats); }

// === MIDDLEWARE ===
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// === MULTER (загрузка файлов) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safe = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// === УТИЛИТЫ ===
function generateId() {
  return crypto.randomBytes(10).toString('hex');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    lastSeenAt: user.lastSeenAt,
  };
}

function getUserById(id) {
  return users.find(u => u.id === id);
}

function isImage(mime) {
  return String(mime || '').toLowerCase().startsWith('image/');
}

function enrichChat(chat, viewerId) {
  const participantsInfo = (chat.participants || [])
    .map(id => publicUser(getUserById(id)))
    .filter(Boolean);

  const onlineParticipantIds = (chat.participants || []).filter(id => onlineUsers.has(id));

  let title = chat.title;
  let avatar = chat.avatar;
  let subtitle = '';
  let otherParticipant = null;
  const isSelfChat = chat.type === 'direct' && chat.participants?.length === 1;

  if (chat.type === 'direct') {
    if (isSelfChat) {
      title = 'Избранное';
      avatar = '⭐';
      subtitle = 'Чат с самим собой';
    } else {
      const otherId = (chat.participants || []).find(id => id !== viewerId);
      otherParticipant = publicUser(getUserById(otherId));
      title = otherParticipant?.username || 'Диалог';
      avatar = otherParticipant?.avatar || '💬';
      subtitle = onlineUsers.has(otherId) ? 'в сети' : 'не в сети';
    }
  } else {
    subtitle = `${participantsInfo.length} участников`;
  }

  const messages = chat.messages || [];
  const lastMessage = messages[messages.length - 1] || null;

  const readState = chat.readState || {};
  const lastReadId = readState[viewerId] || null;
  let unreadCount = 0;
  if (lastReadId) {
    const idx = messages.findIndex(m => m.id === lastReadId);
    unreadCount = messages.slice(idx + 1).filter(m => m.senderId !== viewerId && m.type !== 'system').length;
  } else {
    unreadCount = messages.filter(m => m.senderId !== viewerId && m.type !== 'system').length;
  }

  return {
    id: chat.id,
    type: chat.type,
    title,
    avatar,
    subtitle,
    isSelfChat,
    participants: chat.participants,
    participantsInfo,
    onlineParticipantIds,
    otherParticipant,
    updatedAt: chat.updatedAt,
    createdAt: chat.createdAt,
    lastMessage,
    unreadCount,
    messages,
  };
}

// === АВТОРИЗАЦИЯ ===
function authMiddleware(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  const user = getUserById(userId);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  req.user = user;
  next();
}

// === ROUTES: АВТОРИЗАЦИЯ ===
app.post('/api/register', (req, res) => {
  const { username, password, avatar } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите имя и пароль' });
  }
  if (username.length < 2) {
    return res.status(400).json({ error: 'Имя слишком короткое' });
  }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Имя уже занято' });
  }

  const user = {
    id: generateId(),
    username: username.trim(),
    passwordHash: hashPassword(password),
    avatar: avatar || '😀',
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
  users.push(user);
  persistUsers();
  res.json(publicUser(user));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите имя и пароль' });
  }
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Неверное имя или пароль' });
  }
  user.lastSeenAt = new Date().toISOString();
  persistUsers();
  res.json(publicUser(user));
});

// === ROUTES: ПОЛЬЗОВАТЕЛИ ===
app.get('/api/users', authMiddleware, (req, res) => {
  res.json(users.map(publicUser));
});

// === ROUTES: ЧАТЫ ===
app.get('/api/chats', authMiddleware, (req, res) => {
  const userChats = chats
    .filter(c => c.participants?.includes(req.user.id))
    .map(c => enrichChat(c, req.user.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json(userChats);
});

app.get('/api/chats/:id', authMiddleware, (req, res) => {
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat || !chat.participants.includes(req.user.id)) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  res.json(enrichChat(chat, req.user.id));
});

app.post('/api/chats', authMiddleware, (req, res) => {
  const { type = 'direct', participantId, participantIds = [], title, avatar, mode } = req.body || {};

  if (type === 'direct') {
    if (mode === 'self' || participantId === req.user.id) {
      // Чат с самим собой
      let existing = chats.find(c => c.type === 'direct' && c.participants?.length === 1 && c.participants[0] === req.user.id);
      if (existing) return res.json(enrichChat(existing, req.user.id));

      const chat = {
        id: generateId(),
        type: 'direct',
        participants: [req.user.id],
        messages: [],
        readState: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      chats.push(chat);
      persistChats();
      broadcastChatCreated(chat);
      return res.json(enrichChat(chat, req.user.id));
    }

    if (!participantId || !getUserById(participantId)) {
      return res.status(400).json({ error: 'Пользователь не найден' });
    }

    let existing = chats.find(c =>
      c.type === 'direct' &&
      c.participants.length === 2 &&
      c.participants.includes(req.user.id) &&
      c.participants.includes(participantId)
    );
    if (existing) return res.json(enrichChat(existing, req.user.id));

    const chat = {
      id: generateId(),
      type: 'direct',
      participants: [req.user.id, participantId],
      messages: [],
      readState: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    chats.push(chat);
    persistChats();
    broadcastChatCreated(chat);
    return res.json(enrichChat(chat, req.user.id));
  }

  if (type === 'group') {
    if (!title || title.length < 2) return res.status(400).json({ error: 'Введите название' });
    const allMembers = [...new Set([req.user.id, ...participantIds])];
    if (allMembers.length < 3) return res.status(400).json({ error: 'Нужно минимум 3 участника' });

    const chat = {
      id: generateId(),
      type: 'group',
      title: String(title).trim(),
      avatar: avatar || '👥',
      participants: allMembers,
      messages: [{
        id: generateId(),
        type: 'system',
        text: `Группа «${title}» создана`,
        senderId: 'system',
        senderName: 'Система',
        timestamp: new Date().toISOString(),
        readBy: [],
      }],
      readState: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    chats.push(chat);
    persistChats();
    broadcastChatCreated(chat);
    return res.json(enrichChat(chat, req.user.id));
  }

  res.status(400).json({ error: 'Неизвестный тип чата' });
});

app.post('/api/chats/:id/read', authMiddleware, (req, res) => {
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat || !chat.participants.includes(req.user.id)) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  const lastMsg = chat.messages[chat.messages.length - 1];
  if (lastMsg) {
    chat.readState = chat.readState || {};
    chat.readState[req.user.id] = lastMsg.id;
    (chat.messages || []).forEach(m => {
      if (m.senderId !== req.user.id && m.type !== 'system') {
        m.readBy = m.readBy || [];
        if (!m.readBy.includes(req.user.id)) m.readBy.push(req.user.id);
      }
    });
    persistChats();
  }
  res.json(enrichChat(chat, req.user.id));
});

// === ROUTES: ФАЙЛЫ ===
app.post('/api/chats/:id/files', authMiddleware, upload.single('file'), (req, res) => {
  const chat = chats.find(c => c.id === req.params.id);
  if (!chat || !chat.participants.includes(req.user.id)) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

  const fileInfo = {
    name: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    url: `/uploads/${req.file.filename}`,
    kind: req.body.kind || 'file',
    durationSec: Number(req.body.durationSec || 0),
    isImage: isImage(req.file.mimetype),
  };

  const message = {
    id: generateId(),
    chatId: chat.id,
    senderId: req.user.id,
    senderName: req.user.username,
    text: (req.body.text || '').trim(),
    file: fileInfo,
    timestamp: new Date().toISOString(),
    readBy: [req.user.id],
  };

  chat.messages.push(message);
  chat.updatedAt = new Date().toISOString();
  persistChats();

  broadcastMessage(chat, message);
  res.json({ ok: true, chat: enrichChat(chat, req.user.id), message });
});

// === WEBSOCKET ===
const wss = new WebSocketServer({ server });
const onlineUsers = new Map(); // userId -> Set<WebSocket>

function broadcastPresence() {
  const payload = JSON.stringify({
    type: 'presence',
    onlineUserIds: [...onlineUsers.keys()],
  });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

function broadcastChatCreated(chat) {
  (chat.participants || []).forEach(uid => {
    const sockets = onlineUsers.get(uid);
    if (!sockets) return;
    const payload = JSON.stringify({
      type: 'chat-created',
      chat: enrichChat(chat, uid),
    });
    sockets.forEach(s => s.readyState === 1 && s.send(payload));
  });
}

function broadcastMessage(chat, message) {
  const summaries = {};
  (chat.participants || []).forEach(uid => {
    summaries[uid] = enrichChat(chat, uid);
  });

  (chat.participants || []).forEach(uid => {
    const sockets = onlineUsers.get(uid);
    if (!sockets) return;
    const payload = JSON.stringify({
      type: 'message',
      chatId: chat.id,
      message,
      summaries,
    });
    sockets.forEach(s => s.readyState === 1 && s.send(payload));
  });
}

wss.on('connection', (ws, req) => {
  const params = url.parse(req.url, true).query;
  const userId = params.userId;
  if (!userId || !getUserById(userId)) {
    ws.close();
    return;
  }

  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(ws);
  ws.userId = userId;
  broadcastPresence();

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === 'message') {
      const chat = chats.find(c => c.id === data.chatId);
      if (!chat || !chat.participants.includes(userId)) return;
      const user = getUserById(userId);
      const message = {
        id: generateId(),
        chatId: chat.id,
        senderId: userId,
        senderName: user.username,
        text: (data.text || '').trim(),
        sticker: data.sticker || null,
        timestamp: new Date().toISOString(),
        readBy: [userId],
      };
      chat.messages.push(message);
      chat.updatedAt = new Date().toISOString();
      persistChats();
      broadcastMessage(chat, message);
      return;
    }

    if (data.type === 'typing') {
      const chat = chats.find(c => c.id === data.chatId);
      if (!chat) return;
      const payload = JSON.stringify({
        type: 'typing',
        chatId: data.chatId,
        userId: data.userId,
        isTyping: data.isTyping,
      });
      (chat.participants || []).forEach(uid => {
        if (uid === userId) return;
        const sockets = onlineUsers.get(uid);
        if (sockets) sockets.forEach(s => s.readyState === 1 && s.send(payload));
      });
      return;
    }

    if (data.type === 'read') {
      const chat = chats.find(c => c.id === data.chatId);
      if (!chat) return;
      const payload = JSON.stringify({
        type: 'read',
        chatId: data.chatId,
        userId: data.userId,
      });
      (chat.participants || []).forEach(uid => {
        const sockets = onlineUsers.get(uid);
        if (sockets) sockets.forEach(s => s.readyState === 1 && s.send(payload));
      });
      return;
    }
  });

  ws.on('close', () => {
    const set = onlineUsers.get(userId);
    if (set) {
      set.delete(ws);
      if (!set.size) onlineUsers.delete(userId);
    }
    const user = getUserById(userId);
    if (user) {
      user.lastSeenAt = new Date().toISOString();
      persistUsers();
    }
    broadcastPresence();
  });
});

// === ЗАПУСК ===
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});