const AVATARS = ['😀', '😎', '🤖', '🦊', '🐼', '🐯', '🐙', '🦄', '🔥', '⚡', '💎', '🌙'];
const GROUP_AVATARS = ['👥', '🚀', '💼', '🎮', '🎵', '📚', '🧠', '🛠️', '🎯', '🏆', '🎬', '🌍'];
const STICKERS = [
  { emoji: '👍', label: 'Ок' },
  { emoji: '❤️', label: 'Любовь' },
  { emoji: '🔥', label: 'Огонь' },
  { emoji: '😂', label: 'Смешно' },
  { emoji: '😮', label: 'Вау' },
  { emoji: '👏', label: 'Браво' },
  { emoji: '🤝', label: 'Согласен' },
  { emoji: '🎉', label: 'Праздник' },
  { emoji: '✅', label: 'Готово' },
  { emoji: '⭐', label: 'Избранное' },
  { emoji: '🚀', label: 'Погнали' },
  { emoji: '💯', label: 'Сто из ста' },
];

const state = {
  currentUser: null,
  users: [],
  chats: [],
  activeChat: null,
  selectedAuthAvatar: '😀',
  selectedGroupAvatar: '👥',
  selectedGroupMembers: new Set(),
  onlineUserIds: new Set(),
  typingUsers: new Map(),
  ws: null,
  reconnectTimer: null,
  typingStopTimer: null,
  detailsVisible: window.innerWidth > 1180,
  selectedFile: null,
  isUploading: false,
  mediaRecorder: null,
  recordingStream: null,
  recordingMode: null,
  recordingStartedAt: 0,
  recordingTimer: null,
  stickerPickerVisible: false,
};

const elements = {
  authScreen: document.getElementById('auth-screen'),
  messengerScreen: document.getElementById('messenger-screen'),
  authUsername: document.getElementById('auth-username'),
  authPassword: document.getElementById('auth-password'),
  loginBtn: document.getElementById('login-btn'),
  registerBtn: document.getElementById('register-btn'),
  authError: document.getElementById('auth-error'),
  avatarPicker: document.getElementById('avatar-picker'),

  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  currentUserCard: document.getElementById('current-user-card'),
  logoutBtn: document.getElementById('logout-btn'),
  openDirectModalBtn: document.getElementById('open-direct-modal-btn'),
  openGroupModalBtn: document.getElementById('open-group-modal-btn'),
  emptyOpenDirectBtn: document.getElementById('empty-open-direct-btn'),
  emptyOpenGroupBtn: document.getElementById('empty-open-group-btn'),
  chatSearch: document.getElementById('chat-search'),
  chatList: document.getElementById('chat-list'),
  totalChatsStat: document.getElementById('total-chats-stat'),
  onlineStat: document.getElementById('online-stat'),
  chatListCaption: document.getElementById('chat-list-caption'),

  emptyState: document.getElementById('empty-state'),
  chatPanel: document.getElementById('chat-panel'),
  mobileSidebarBtn: document.getElementById('mobile-sidebar-btn'),
  refreshChatBtn: document.getElementById('refresh-chat-btn'),
  toggleDetailsBtn: document.getElementById('toggle-details-btn'),

  chatHeaderAvatar: document.getElementById('chat-header-avatar'),
  chatHeaderName: document.getElementById('chat-header-name'),
  chatHeaderBadge: document.getElementById('chat-header-badge'),
  chatHeaderStatus: document.getElementById('chat-header-status'),
  messages: document.getElementById('messages'),
  typingIndicator: document.getElementById('typing-indicator'),
  composerHint: document.getElementById('composer-hint'),
  selectedFileBox: document.getElementById('selected-file-box'),
  selectedFileName: document.getElementById('selected-file-name'),
  selectedFileSize: document.getElementById('selected-file-size'),
  fileInput: document.getElementById('file-input'),
  attachFileBtn: document.getElementById('attach-file-btn'),
  clearFileBtn: document.getElementById('clear-file-btn'),
  recordingStatus: document.getElementById('recording-status'),
  stickerPicker: document.getElementById('sticker-picker'),
  recordVoiceBtn: document.getElementById('record-voice-btn'),
  recordCircleBtn: document.getElementById('record-circle-btn'),
  openStickersBtn: document.getElementById('open-stickers-btn'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),

  detailsPanel: document.getElementById('details-panel'),
  detailsAvatar: document.getElementById('details-avatar'),
  detailsTitle: document.getElementById('details-title'),
  detailsSubtitle: document.getElementById('details-subtitle'),
  detailsType: document.getElementById('details-type'),
  detailsMessagesCount: document.getElementById('details-messages-count'),
  detailsMembersCount: document.getElementById('details-members-count'),
  detailsOnlineCount: document.getElementById('details-online-count'),
  membersList: document.getElementById('members-list'),

  directModal: document.getElementById('direct-modal'),
  directUserSearch: document.getElementById('direct-user-search'),
  directUserList: document.getElementById('direct-user-list'),

  groupModal: document.getElementById('group-modal'),
  groupTitle: document.getElementById('group-title'),
  groupAvatarPicker: document.getElementById('group-avatar-picker'),
  groupUserSearch: document.getElementById('group-user-search'),
  groupUserList: document.getElementById('group-user-list'),
  createGroupBtn: document.getElementById('create-group-btn'),

  toastContainer: document.getElementById('toast-container'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(title, message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-message">${escapeHtml(message)}</div>
  `;
  elements.toastContainer.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} МБ`;
}

function getFileLabel(file) {
  if (!file) return '';
  const kind = String(file.kind || '').toLowerCase();
  if (kind === 'voice') return '🎤 Голосовое';
  if (kind === 'video-note') return '◉ Кружок';
  if (file.isImage) return '🖼️ Фото';
  const mime = String(file.mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return '📄 PDF';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return '🗜️ Архив';
  if (mime.includes('audio')) return '🎵 Аудио';
  if (mime.includes('video')) return '🎬 Видео';
  if (mime.includes('word') || mime.includes('document')) return '📝 Документ';
  return '📎 Файл';
}

function formatDuration(totalSeconds) {
  const value = Math.max(Math.round(Number(totalSeconds || 0)), 0);
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getRecordingMime(mode) {
  const candidates = mode === 'video-note'
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

  return candidates.find((item) => window.MediaRecorder?.isTypeSupported?.(item)) || '';
}

function stopActiveTracks() {
  if (state.recordingStream) {
    state.recordingStream.getTracks().forEach((track) => track.stop());
    state.recordingStream = null;
  }
}

function setStickerPickerVisible(visible) {
  state.stickerPickerVisible = Boolean(visible);
  elements.stickerPicker.classList.toggle('hidden', !state.stickerPickerVisible);
  elements.openStickersBtn.classList.toggle('active-tool', state.stickerPickerVisible);
}

function renderSelectedFile() {
  const file = state.selectedFile;
  if (!file) {
    elements.selectedFileBox.classList.add('hidden');
    elements.selectedFileName.textContent = '';
    elements.selectedFileSize.textContent = '';
    return;
  }

  elements.selectedFileBox.classList.remove('hidden');
  elements.selectedFileName.textContent = file.name;
  elements.selectedFileSize.textContent = `${getFileLabel({ mimeType: file.type, isImage: String(file.type || '').startsWith('image/') })} • ${formatFileSize(file.size)}`;
}

function clearSelectedFile() {
  state.selectedFile = null;
  if (elements.fileInput) {
    elements.fileInput.value = '';
  }
  renderSelectedFile();
}

function renderRecordingStatus() {
  const isRecording = Boolean(state.mediaRecorder && state.mediaRecorder.state === 'recording');
  if (!isRecording) {
    elements.recordingStatus.classList.add('hidden');
    elements.recordingStatus.textContent = '';
    elements.recordVoiceBtn.classList.remove('active-tool');
    elements.recordCircleBtn.classList.remove('active-tool');
    return;
  }

  const elapsed = Math.max(Math.floor((Date.now() - state.recordingStartedAt) / 1000), 0);
  const label = state.recordingMode === 'video-note' ? 'Запись кружка' : 'Запись голосового';
  elements.recordingStatus.classList.remove('hidden');
  elements.recordingStatus.textContent = `● ${label}: ${formatDuration(elapsed)}`;
  elements.recordVoiceBtn.classList.toggle('active-tool', state.recordingMode === 'voice');
  elements.recordCircleBtn.classList.toggle('active-tool', state.recordingMode === 'video-note');
}

function startRecordingTimer() {
  clearInterval(state.recordingTimer);
  state.recordingTimer = setInterval(renderRecordingStatus, 500);
  renderRecordingStatus();
}

function stopRecordingTimer() {
  clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  renderRecordingStatus();
}

function renderStickerPicker() {
  elements.stickerPicker.innerHTML = '';
  STICKERS.forEach((sticker) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-btn';
    button.title = sticker.label;
    button.innerHTML = `<span class="sticker-btn-emoji">${escapeHtml(sticker.emoji)}</span><span class="sticker-btn-label">${escapeHtml(sticker.label)}</span>`;
    button.addEventListener('click', () => sendSticker(sticker));
    elements.stickerPicker.appendChild(button);
  });
}

function showSidebar() {
  elements.sidebar.classList.add('visible');
  elements.sidebarBackdrop.classList.remove('hidden');
}

function hideSidebar() {
  elements.sidebar.classList.remove('visible');
  elements.sidebarBackdrop.classList.add('hidden');
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (state.currentUser?.id) {
    headers.set('x-user-id', state.currentUser.id);
  }

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(payload.error || 'Ошибка запроса');
  }

  return payload;
}

function setScreen(isAuthenticated) {
  elements.authScreen.classList.toggle('hidden', isAuthenticated);
  elements.messengerScreen.classList.toggle('hidden', !isAuthenticated);
}

function showAuthMessage(message = '', type = '') {
  elements.authError.textContent = message;
  elements.authError.className = `auth-error${type ? ` ${type}` : ''}`;
}

function setCurrentUser(user) {
  state.currentUser = user;
  localStorage.setItem('messenger_user', JSON.stringify(user));
  renderCurrentUserCard();
}

function clearCurrentUser() {
  state.currentUser = null;
  state.users = [];
  state.chats = [];
  state.activeChat = null;
  state.onlineUserIds = new Set();
  state.typingUsers.clear();
  localStorage.removeItem('messenger_user');
  disconnectWebSocket();
}

function renderAvatarSet(container, avatars, selected, onSelect) {
  container.innerHTML = '';
  avatars.forEach((avatar) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `avatar-option${selected === avatar ? ' active' : ''}`;
    button.textContent = avatar;
    button.addEventListener('click', () => onSelect(avatar));
    container.appendChild(button);
  });
}

function renderCurrentUserCard() {
  if (!state.currentUser) {
    elements.currentUserCard.innerHTML = '';
    return;
  }

  const online = state.onlineUserIds.has(state.currentUser.id) ? 'в сети' : 'офлайн';
  elements.currentUserCard.innerHTML = `
    <div class="user-avatar">${escapeHtml(state.currentUser.avatar)}</div>
    <div class="current-user-meta">
      <div class="current-user-name">${escapeHtml(state.currentUser.username)}</div>
      <div class="current-user-id">${escapeHtml(online)}</div>
    </div>
  `;
}

function formatListTime(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatDateSeparator(isoDate) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  }).format(date);
}

function formatMessageTime(isoDate) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function getLastSeenText(user) {
  if (!user) return '';
  if (state.onlineUserIds.has(user.id)) return 'в сети';
  if (!user.lastSeenAt) return 'не в сети';
  return `был(а) ${formatListTime(user.lastSeenAt)}`;
}

function getChatTypeLabel(chat) {
  if (chat?.isSelfChat) return 'Избранное';
  return chat?.type === 'group' ? 'Группа' : 'Диалог';
}

function getFilteredChats() {
  const query = elements.chatSearch.value.trim().toLowerCase();
  if (!query) return state.chats;

  return state.chats.filter((chat) => {
    const haystack = [
      chat.title,
      chat.subtitle,
      ...(chat.participantsInfo || []).map((user) => user.username),
      chat.lastMessage?.text,
      chat.lastMessage?.file?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function messagePreview(message) {
  if (!message) return 'Сообщений пока нет';
  if (message.type === 'system') return message.text;
  if (message.sticker) return `${message.senderName}: стикер ${message.sticker.emoji}`;
  if (message.file && message.text) return `${message.senderName}: ${getFileLabel(message.file)} • ${message.text}`;
  if (message.file) return `${message.senderName}: ${getFileLabel(message.file)}${message.file.durationSec ? ` ${formatDuration(message.file.durationSec)}` : ''}`;
  return `${message.senderName}: ${message.text}`;
}

function renderStats() {
  elements.totalChatsStat.textContent = String(state.chats.length);
  elements.onlineStat.textContent = String(state.onlineUserIds.size);

  const filteredCount = getFilteredChats().length;
  elements.chatListCaption.textContent = filteredCount === state.chats.length
    ? `${state.chats.length}`
    : `${filteredCount} из ${state.chats.length}`;
}

function renderChatList() {
  const chats = getFilteredChats();
  elements.chatList.innerHTML = '';
  renderStats();

  if (!chats.length) {
    elements.chatList.innerHTML = '<div class="empty-list">Чаты не найдены.</div>';
    return;
  }

  chats.forEach((chat) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-item${state.activeChat?.id === chat.id ? ' active' : ''}`;
    button.innerHTML = `
      <div class="chat-avatar">${escapeHtml(chat.avatar || '💬')}</div>
      <div class="chat-item-body">
        <div class="chat-item-top">
          <div class="chat-item-name">${escapeHtml(chat.title || 'Чат')}</div>
          <div class="chat-item-time">${escapeHtml(formatListTime(chat.updatedAt))}</div>
        </div>
        <div class="chat-item-preview">${escapeHtml(messagePreview(chat.lastMessage))}</div>
        <div class="chat-item-meta">
          <span class="chat-inline-badge">${escapeHtml(getChatTypeLabel(chat))}</span>
          ${chat.unreadCount ? `<span class="unread-badge">${chat.unreadCount}</span>` : `<span class="muted-text">${escapeHtml(chat.subtitle || '')}</span>`}
        </div>
      </div>
    `;

    button.addEventListener('click', async () => {
      await openChat(chat.id);
      closeSidebarOnMobile();
    });

    elements.chatList.appendChild(button);
  });
}

function renderDetailsPanel() {
  const chat = state.activeChat;
  if (!chat) {
    elements.detailsPanel.classList.add('hidden');
    return;
  }

  elements.detailsPanel.classList.remove('hidden');
  elements.detailsPanel.classList.toggle('visible', state.detailsVisible);
  elements.detailsAvatar.textContent = chat.avatar || '💬';
  elements.detailsTitle.textContent = chat.title || 'Чат';
  elements.detailsSubtitle.textContent = chat.subtitle || '';
  elements.detailsType.textContent = getChatTypeLabel(chat);
  elements.detailsMessagesCount.textContent = String(chat.messages?.length || 0);
  elements.detailsMembersCount.textContent = String(chat.participantsInfo?.length || 0);
  elements.detailsOnlineCount.textContent = String(chat.onlineParticipantIds?.length || 0);

  elements.membersList.innerHTML = '';
  (chat.participantsInfo || []).forEach((user) => {
    const row = document.createElement('div');
    const isOnline = state.onlineUserIds.has(user.id);
    row.className = 'member-row';
    row.innerHTML = `
      <div class="member-avatar">${escapeHtml(user.avatar)}</div>
      <div class="member-body">
        <div class="member-name">${escapeHtml(user.username)}${user.id === state.currentUser.id ? ' (вы)' : ''}</div>
        <div class="member-subtitle">${escapeHtml(getLastSeenText(user))}</div>
      </div>
      <div class="member-presence${isOnline ? ' online' : ''}"></div>
    `;
    elements.membersList.appendChild(row);
  });
}

function renderActiveChatHeader() {
  if (!state.activeChat) return;

  const chat = state.activeChat;
  elements.chatHeaderAvatar.textContent = chat.avatar || '💬';
  elements.chatHeaderName.textContent = chat.title || 'Чат';
  elements.chatHeaderBadge.textContent = getChatTypeLabel(chat);

  if (chat.type === 'group') {
    const total = chat.participantsInfo?.length || 0;
    const online = chat.onlineParticipantIds?.length || 0;
    elements.chatHeaderStatus.textContent = `${total} участников • онлайн ${online}`;
  } else if (chat.isSelfChat) {
    elements.chatHeaderStatus.textContent = 'Личный чат для заметок, голосовых, кружков и стикеров';
  } else {
    elements.chatHeaderStatus.textContent = chat.otherParticipant ? getLastSeenText(chat.otherParticipant) : '';
  }
}

function renderTypingIndicator() {
  const names = [...state.typingUsers.values()];
  if (!names.length) {
    elements.typingIndicator.textContent = '';
    return;
  }

  elements.typingIndicator.textContent = names.length === 1
    ? `${names[0]} печатает...`
    : `Печатают: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
}

function createDateSeparator(isoDate) {
  const node = document.createElement('div');
  node.className = 'date-separator';
  node.innerHTML = `<span>${escapeHtml(formatDateSeparator(isoDate))}</span>`;
  return node;
}

function getReadMark(message) {
  if (!state.activeChat || message.senderId !== state.currentUser.id) return '';
  if (state.activeChat.type === 'group') {
    const count = Math.max((message.readBy || []).filter((id) => id !== state.currentUser.id).length, 0);
    return count > 0 ? `Прочитали: ${count}` : 'Отправлено';
  }

  if (state.activeChat.isSelfChat) {
    return 'Сохранено';
  }

  const other = state.activeChat.otherParticipant;
  const isRead = other ? (message.readBy || []).includes(other.id) : false;
  return isRead ? '✓✓' : '✓';
}

function createMessageRow(message) {
  const row = document.createElement('div');
  const type = message.type === 'system'
    ? 'system'
    : (message.senderId === state.currentUser.id ? 'outgoing' : 'incoming');
  row.className = `message-row ${type}`;
  row.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (message.type === 'system') {
    bubble.innerHTML = `<div class="message-text">${escapeHtml(message.text)}</div>`;
    row.appendChild(bubble);
    return row;
  }

  if (message.senderId !== state.currentUser.id && state.activeChat?.type === 'group') {
    const author = document.createElement('div');
    author.className = 'message-author';
    author.textContent = message.senderName;
    bubble.appendChild(author);
  }

  if (message.sticker) {
    const stickerNode = document.createElement('div');
    stickerNode.className = 'message-sticker';
    stickerNode.textContent = message.sticker.emoji || '⭐';
    bubble.appendChild(stickerNode);

    if (message.text) {
      const caption = document.createElement('div');
      caption.className = 'message-text';
      caption.textContent = message.text;
      bubble.appendChild(caption);
    }
  }

  if (message.file) {
    const mime = String(message.file.mimeType || '').toLowerCase();
    const kind = String(message.file.kind || '').toLowerCase();
    const attachment = document.createElement('div');
    attachment.className = `attachment-card${kind === 'video-note' ? ' video-note-wrap' : ''}`;

    if (kind === 'voice' || mime.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.className = 'audio-message';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = message.file.url;
      attachment.appendChild(audio);

      const voiceMeta = document.createElement('div');
      voiceMeta.className = 'attachment-inline-meta';
      voiceMeta.textContent = `${getFileLabel(message.file)}${message.file.durationSec ? ` • ${formatDuration(message.file.durationSec)}` : ''}`;
      attachment.appendChild(voiceMeta);
    } else if (kind === 'video-note') {
      const video = document.createElement('video');
      video.className = 'video-note-player';
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.src = message.file.url;
      attachment.appendChild(video);

      const noteMeta = document.createElement('div');
      noteMeta.className = 'attachment-inline-meta center';
      noteMeta.textContent = `${getFileLabel(message.file)}${message.file.durationSec ? ` • ${formatDuration(message.file.durationSec)}` : ''}`;
      attachment.appendChild(noteMeta);
    } else if (message.file.isImage) {
      const preview = document.createElement('a');
      preview.href = message.file.url;
      preview.target = '_blank';
      preview.rel = 'noreferrer';
      preview.className = 'attachment-preview';
      preview.innerHTML = `<img src="${escapeHtml(message.file.url)}" alt="${escapeHtml(message.file.name)}" loading="lazy" />`;
      attachment.appendChild(preview);
    } else if (mime.startsWith('video/')) {
      const preview = document.createElement('video');
      preview.className = 'video-message';
      preview.controls = true;
      preview.preload = 'metadata';
      preview.playsInline = true;
      preview.src = message.file.url;
      attachment.appendChild(preview);
    }

    const fileLink = document.createElement('a');
    fileLink.className = 'attachment-link';
    fileLink.href = message.file.url;
    fileLink.target = '_blank';
    fileLink.rel = 'noreferrer';
    fileLink.download = message.file.name;
    fileLink.innerHTML = `
      <div class="attachment-icon">${escapeHtml(getFileLabel(message.file).split(' ')[0])}</div>
      <div class="attachment-meta">
        <div class="attachment-name">${escapeHtml(message.file.name)}</div>
        <div class="attachment-size">${escapeHtml(formatFileSize(message.file.size))}${message.file.durationSec ? ` • ${escapeHtml(formatDuration(message.file.durationSec))}` : ''}</div>
      </div>
    `;
    attachment.appendChild(fileLink);
    bubble.appendChild(attachment);
  }

  if (message.text && !message.sticker) {
    const textNode = document.createElement('div');
    textNode.className = 'message-text';
    textNode.textContent = message.text;
    bubble.appendChild(textNode);
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `
    <span>${escapeHtml(formatMessageTime(message.timestamp))}</span>
    ${getReadMark(message) ? `<span class="message-checks">${escapeHtml(getReadMark(message))}</span>` : ''}
  `;

  bubble.appendChild(meta);
  row.appendChild(bubble);
  return row;
}

function scrollMessagesToBottom() {
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderMessages(messages) {
  elements.messages.innerHTML = '';

  if (!messages.length) {
    elements.messages.innerHTML = '<div class="empty-list">Здесь пока нет сообщений.</div>';
    return;
  }

  let previousDay = '';
  messages.forEach((message) => {
    const day = new Date(message.timestamp).toDateString();
    if (day !== previousDay) {
      previousDay = day;
      elements.messages.appendChild(createDateSeparator(message.timestamp));
    }
    elements.messages.appendChild(createMessageRow(message));
  });

  scrollMessagesToBottom();
}

function patchActiveChatSummary() {
  if (!state.activeChat) return;
  const index = state.chats.findIndex((chat) => chat.id === state.activeChat.id);
  if (index >= 0) {
    state.chats[index] = {
      ...state.chats[index],
      ...state.activeChat,
      messages: state.chats[index].messages,
    };
  }
}

function upsertChatSummary(chat) {
  if (!chat) return;
  const index = state.chats.findIndex((item) => item.id === chat.id);
  if (index >= 0) {
    state.chats[index] = { ...state.chats[index], ...chat };
  } else {
    state.chats.unshift(chat);
  }

  state.chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function loadUsers() {
  const users = await api('/api/users');
  state.users = users.filter((user) => user.id !== state.currentUser.id);
  renderDirectUserList();
  renderGroupUserList();
}

async function loadChats() {
  const chats = await api('/api/chats');
  state.chats = chats;
  renderChatList();
}

async function markChatRead(chatId) {
  try {
    const chat = await api(`/api/chats/${chatId}/read`, { method: 'POST' });
    if (state.activeChat?.id === chatId) {
      state.activeChat = chat;
      patchActiveChatSummary();
      renderActiveChatHeader();
      renderMessages(chat.messages || []);
      renderDetailsPanel();
    }
    upsertChatSummary(chat);
    renderChatList();

    if (state.ws?.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'read', chatId, userId: state.currentUser.id }));
    }
  } catch (error) {
    console.error(error);
  }
}

function joinActiveChat() {
  if (!state.activeChat || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({
    type: 'join',
    chatId: state.activeChat.id,
    userId: state.currentUser.id,
  }));
}

async function openChat(chatId) {
  const chat = await api(`/api/chats/${chatId}`);
  state.activeChat = chat;
  state.typingUsers.clear();
  setStickerPickerVisible(false);

  elements.emptyState.classList.add('hidden');
  elements.chatPanel.classList.remove('hidden');

  renderActiveChatHeader();
  renderMessages(chat.messages || []);
  renderTypingIndicator();
  renderDetailsPanel();
  patchActiveChatSummary();
  renderChatList();
  joinActiveChat();
  closeSidebarOnMobile();
  renderSelectedFile();
  elements.messageInput.focus();

  await markChatRead(chat.id);
}

function autoResizeTextarea() {
  elements.messageInput.style.height = '56px';
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 170)}px`;
}

function emitTyping(isTyping) {
  if (!state.activeChat || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({
    type: 'typing',
    userId: state.currentUser.id,
    chatId: state.activeChat.id,
    isTyping,
  }));
}

async function uploadMultipartMessage(file, { text = '', kind = 'file', durationSec = 0, clearAfter = true } = {}) {
  if (!state.activeChat || !file || state.isUploading) return;

  state.isUploading = true;
  elements.sendBtn.disabled = true;
  elements.sendBtn.textContent = 'Загрузка…';

  try {
    const formData = new FormData();
    formData.append('file', file, file.name || 'file');
    formData.append('text', text.trim());
    formData.append('kind', kind);
    if (durationSec) {
      formData.append('durationSec', String(durationSec));
    }

    const headers = new Headers();
    headers.set('x-user-id', state.currentUser.id);
    const response = await fetch(`/api/chats/${encodeURIComponent(state.activeChat.id)}/files`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(payload.error || 'Не удалось загрузить файл');
    }

    if (clearAfter) {
      clearSelectedFile();
      elements.messageInput.value = '';
      autoResizeTextarea();
      emitTyping(false);
      clearTimeout(state.typingStopTimer);
    }

    if (payload.chat) {
      upsertChatSummary(payload.chat);
      renderChatList();
    }
  } finally {
    state.isUploading = false;
    elements.sendBtn.disabled = false;
    elements.sendBtn.textContent = 'Отправить';
  }
}

async function uploadSelectedFileMessage() {
  if (!state.selectedFile) return;
  await uploadMultipartMessage(state.selectedFile, {
    text: elements.messageInput.value,
    kind: 'file',
    clearAfter: true,
  });
}

async function stopRecording(send = true) {
  const recorder = state.mediaRecorder;
  if (!recorder) return;

  return new Promise((resolve) => {
    const mode = state.recordingMode;
    const startedAt = state.recordingStartedAt;
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      stopRecordingTimer();
      stopActiveTracks();
      state.mediaRecorder = null;
      state.recordingMode = null;
      resolve(false);
    };

    recorder.onstop = async () => {
      const durationSec = Math.max(Math.round((Date.now() - startedAt) / 1000), 1);
      stopRecordingTimer();
      stopActiveTracks();
      state.mediaRecorder = null;
      state.recordingMode = null;

      if (!send || !chunks.length) {
        resolve(false);
        return;
      }

      try {
        const mimeType = recorder.mimeType || (mode === 'video-note' ? 'video/webm' : 'audio/webm');
        const extension = mimeType.includes('mp4') ? 'mp4' : (mode === 'video-note' ? 'webm' : 'webm');
        const blob = new Blob(chunks, { type: mimeType });
        const filename = mode === 'video-note' ? `circle-${Date.now()}.${extension}` : `voice-${Date.now()}.${extension}`;
        const file = new File([blob], filename, { type: mimeType });
        await uploadMultipartMessage(file, {
          text: mode === 'video-note' ? '' : elements.messageInput.value,
          kind: mode,
          durationSec,
          clearAfter: mode !== 'video-note',
        });
        if (mode === 'video-note') {
          elements.messageInput.value = '';
          autoResizeTextarea();
        }
        resolve(true);
      } catch (error) {
        console.error(error);
        showToast('Запись', error.message || 'Не удалось отправить запись.');
        resolve(false);
      }
    };

    try {
      recorder.stop();
    } catch (error) {
      console.error(error);
      resolve(false);
    }
  });
}

async function startRecording(mode) {
  if (!state.activeChat) {
    showToast('Запись', 'Сначала откройте чат.');
    return;
  }

  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    showToast('Запись', 'Браузер не поддерживает запись медиа.');
    return;
  }

  if (state.mediaRecorder) {
    if (state.recordingMode === mode) {
      await stopRecording(true);
      return;
    }
    await stopRecording(true);
  }

  try {
    setStickerPickerVisible(false);
    clearSelectedFile();
    const constraints = mode === 'video-note' ? { audio: true, video: { facingMode: 'user' } } : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.recordingStream = stream;
    const mimeType = getRecordingMime(mode);
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    state.mediaRecorder = recorder;
    state.recordingMode = mode;
    state.recordingStartedAt = Date.now();
    startRecordingTimer();
    recorder.start();
  } catch (error) {
    console.error(error);
    stopRecordingTimer();
    stopActiveTracks();
    state.mediaRecorder = null;
    state.recordingMode = null;
    showToast('Запись', 'Не удалось получить доступ к микрофону или камере.');
  }
}

async function ensureFavoritesChat() {
  const existing = state.chats.find((chat) => chat.isSelfChat);
  if (existing) {
    return existing;
  }

  const chat = await api('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ type: 'direct', mode: 'self', participantId: state.currentUser.id }),
  });
  upsertChatSummary(chat);
  renderChatList();
  return chat;
}

async function sendSticker(sticker) {
  if (!state.activeChat) {
    showToast('Стикеры', 'Сначала откройте чат.');
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showToast('Нет соединения', 'WebSocket ещё не подключён.');
    return;
  }

  state.ws.send(JSON.stringify({
    type: 'message',
    chatId: state.activeChat.id,
    senderId: state.currentUser.id,
    sticker,
  }));
  setStickerPickerVisible(false);
}

async function handleSendMessage() {
  const text = elements.messageInput.value.trim();
  if (!state.activeChat) return;

  if (state.selectedFile) {
    await uploadSelectedFileMessage();
    return;
  }

  if (!text) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showToast('Нет соединения', 'WebSocket ещё не подключён.');
    return;
  }

  setStickerPickerVisible(false);
  state.ws.send(JSON.stringify({
    type: 'message',
    chatId: state.activeChat.id,
    senderId: state.currentUser.id,
    text,
  }));

  elements.messageInput.value = '';
  autoResizeTextarea();
  emitTyping(false);
  clearTimeout(state.typingStopTimer);
}

function renderDirectUserList() {
  const query = elements.directUserSearch.value.trim().toLowerCase();
  const filtered = state.users.filter((user) => user.username.toLowerCase().includes(query));
  elements.directUserList.innerHTML = '';

  if (!query || 'избранное'.includes(query) || 'favorites'.includes(query) || 'saved'.includes(query)) {
    const favoritesButton = document.createElement('button');
    favoritesButton.type = 'button';
    favoritesButton.className = 'user-option favorites-option';
    favoritesButton.innerHTML = `
      <div class="chat-avatar">⭐</div>
      <div class="chat-item-body">
        <div class="chat-item-name">Избранное</div>
        <div class="chat-item-preview">Чат с самим собой для заметок и медиа</div>
      </div>
    `;
    favoritesButton.addEventListener('click', async () => {
      try {
        const chat = await ensureFavoritesChat();
        closeModal('direct-modal');
        await openChat(chat.id);
      } catch (error) {
        showToast('Ошибка', error.message);
      }
    });
    elements.directUserList.appendChild(favoritesButton);
  }

  if (!filtered.length && elements.directUserList.children.length === 0) {
    elements.directUserList.innerHTML = '<div class="empty-list">Пользователи не найдены.</div>';
    return;
  }

  filtered.forEach((user) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'user-option';
    button.innerHTML = `
      <div class="chat-avatar">${escapeHtml(user.avatar)}</div>
      <div class="chat-item-body">
        <div class="chat-item-name">${escapeHtml(user.username)}</div>
        <div class="chat-item-preview">${escapeHtml(getLastSeenText(user))}</div>
      </div>
    `;
    button.addEventListener('click', async () => {
      try {
        const chat = await api('/api/chats', {
          method: 'POST',
          body: JSON.stringify({ participantId: user.id }),
        });
        upsertChatSummary(chat);
        renderChatList();
        closeModal('direct-modal');
        await openChat(chat.id);
      } catch (error) {
        showToast('Ошибка', error.message);
      }
    });
    elements.directUserList.appendChild(button);
  });
}

function renderGroupUserList() {
  const query = elements.groupUserSearch.value.trim().toLowerCase();
  const filtered = state.users.filter((user) => user.username.toLowerCase().includes(query));
  elements.groupUserList.innerHTML = '';

  if (!filtered.length) {
    elements.groupUserList.innerHTML = '<div class="empty-list">Пользователи не найдены.</div>';
    return;
  }

  filtered.forEach((user) => {
    const selected = state.selectedGroupMembers.has(user.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `user-option${selected ? ' selected' : ''}`;
    button.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;min-width:0;flex:1;">
        <div class="chat-avatar">${escapeHtml(user.avatar)}</div>
        <div class="chat-item-body">
          <div class="chat-item-name">${escapeHtml(user.username)}</div>
          <div class="chat-item-preview">${escapeHtml(getLastSeenText(user))}</div>
        </div>
      </div>
      <div class="checkbox-pill">✓</div>
    `;
    button.addEventListener('click', () => {
      if (state.selectedGroupMembers.has(user.id)) {
        state.selectedGroupMembers.delete(user.id);
      } else {
        state.selectedGroupMembers.add(user.id);
      }
      renderGroupUserList();
    });
    elements.groupUserList.appendChild(button);
  });
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function resetGroupModal() {
  state.selectedGroupAvatar = '👥';
  state.selectedGroupMembers.clear();
  elements.groupTitle.value = '';
  elements.groupUserSearch.value = '';
  renderGroupAvatarPicker();
  renderGroupUserList();
}

function renderGroupAvatarPicker() {
  renderAvatarSet(elements.groupAvatarPicker, GROUP_AVATARS, state.selectedGroupAvatar, (avatar) => {
    state.selectedGroupAvatar = avatar;
    renderGroupAvatarPicker();
  });
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 900) {
    hideSidebar();
  }
}

function toggleDetails() {
  state.detailsVisible = !state.detailsVisible;
  renderDetailsPanel();
}

function updatePresenceDependentUI() {
  renderCurrentUserCard();
  renderChatList();

  if (state.activeChat) {
    state.activeChat.onlineParticipantIds = state.activeChat.participants.filter((id) => state.onlineUserIds.has(id));
    if (state.activeChat.otherParticipant) {
      const updatedOther = state.users.find((user) => user.id === state.activeChat.otherParticipant.id);
      if (updatedOther) {
        state.activeChat.otherParticipant = updatedOther;
      }
    }
    renderActiveChatHeader();
    renderDetailsPanel();
  }

  renderDirectUserList();
  renderGroupUserList();
  renderStats();
}

function patchActiveMessage(payloadMessage) {
  if (!state.activeChat || state.activeChat.id !== payloadMessage.chatId) return;
  state.activeChat.messages = state.activeChat.messages || [];
  const exists = state.activeChat.messages.some((message) => message.id === payloadMessage.message.id);
  if (!exists) {
    state.activeChat.messages.push(payloadMessage.message);
    renderMessages(state.activeChat.messages);
  }
}

function updateSummaryFromSocket(payload) {
  const summary = payload?.summaries?.[state.currentUser.id];
  if (!summary) return;
  upsertChatSummary(summary);

  if (state.activeChat?.id === summary.id) {
    state.activeChat = { ...state.activeChat, ...summary, messages: state.activeChat.messages };
  }
}

function handleSocketMessage(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch (error) {
    return;
  }

  if (payload.type === 'presence') {
    state.onlineUserIds = new Set(payload.onlineUserIds || []);
    updatePresenceDependentUI();
    return;
  }

  if (payload.type === 'chat-created' && payload.chat) {
    upsertChatSummary(payload.chat);
    renderChatList();
    return;
  }

  if (payload.type === 'message') {
    updateSummaryFromSocket(payload);
    patchActiveMessage(payload);
    renderChatList();

    if (state.activeChat?.id === payload.chatId) {
      state.typingUsers.delete(payload.message.senderId);
      renderTypingIndicator();
      if (payload.message.senderId !== state.currentUser.id) {
        markChatRead(payload.chatId);
      }
    } else if (payload.message.senderId !== state.currentUser.id) {
      const summary = state.chats.find((chat) => chat.id === payload.chatId);
      const preview = payload.message.sticker
        ? `Стикер ${payload.message.sticker.emoji}`
        : (payload.message.file ? `${getFileLabel(payload.message.file)} ${payload.message.file.name || ''}`.trim() : payload.message.text);
      showToast(summary?.title || payload.message.senderName, preview);
    }
    return;
  }

  if (payload.type === 'typing') {
    if (!state.activeChat || state.activeChat.id !== payload.chatId || payload.userId === state.currentUser.id) {
      return;
    }
    const user = state.users.find((item) => item.id === payload.userId)
      || state.activeChat.participantsInfo.find((item) => item.id === payload.userId);

    if (payload.isTyping) {
      state.typingUsers.set(payload.userId, user?.username || 'Пользователь');
    } else {
      state.typingUsers.delete(payload.userId);
    }
    renderTypingIndicator();
    return;
  }

  if (payload.type === 'read') {
    if (state.activeChat?.id === payload.chatId) {
      state.activeChat.messages = (state.activeChat.messages || []).map((message) => {
        if (message.senderId !== payload.userId && !message.readBy?.includes(payload.userId) && message.senderId !== 'system') {
          return {
            ...message,
            readBy: [...(message.readBy || []), payload.userId],
            read: true,
          };
        }
        return message;
      });
      renderMessages(state.activeChat.messages);
    }
    return;
  }

  if (payload.type === 'error') {
    showToast('WebSocket ошибка', payload.error || 'Неизвестная ошибка');
  }
}

function disconnectWebSocket() {
  clearTimeout(state.reconnectTimer);
  if (state.ws) {
    state.ws.onclose = null;
    state.ws.close();
    state.ws = null;
  }
}

function connectWebSocket() {
  disconnectWebSocket();
  if (!state.currentUser) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}?userId=${encodeURIComponent(state.currentUser.id)}`;
  const ws = new WebSocket(url);
  state.ws = ws;

  ws.onopen = () => {
    joinActiveChat();
  };

  ws.onmessage = handleSocketMessage;

  ws.onclose = () => {
    if (!state.currentUser) return;
    state.reconnectTimer = setTimeout(connectWebSocket, 1800);
  };
}

async function enterMessenger() {
  setScreen(true);
  renderCurrentUserCard();
  await Promise.all([loadUsers(), loadChats()]);
  connectWebSocket();

  if (state.chats.length) {
    const preferredId = state.activeChat?.id;
    const initialChat = state.chats.find((chat) => chat.id === preferredId) || state.chats[0];
    await openChat(initialChat.id);
  } else {
    renderChatList();
  }
}

async function handleLogout() {
  await stopRecording(false);
  clearCurrentUser();
  setScreen(false);
  elements.chatList.innerHTML = '';
  elements.messages.innerHTML = '';
  elements.detailsPanel.classList.add('hidden');
  elements.chatPanel.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
  elements.authUsername.value = '';
  elements.authPassword.value = '';
  showAuthMessage('');
}

async function handleLogin() {
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  if (!username || !password) {
    showAuthMessage('Введите имя пользователя и пароль.', 'error');
    return;
  }

  try {
    const user = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setCurrentUser(user);
    elements.authPassword.value = '';
    showAuthMessage('');
    await enterMessenger();
  } catch (error) {
    showAuthMessage(error.message, 'error');
  }
}

async function handleRegister() {
  const username = elements.authUsername.value.trim();
  const password = elements.authPassword.value;
  if (!username || !password) {
    showAuthMessage('Введите имя пользователя и пароль.', 'error');
    return;
  }

  try {
    const user = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        avatar: state.selectedAuthAvatar,
      }),
    });
    setCurrentUser(user);
    elements.authPassword.value = '';
    showAuthMessage('Регистрация выполнена.', 'success');
    await enterMessenger();
  } catch (error) {
    showAuthMessage(error.message, 'error');
  }
}

async function handleCreateGroup() {
  const title = elements.groupTitle.value.trim();
  const participantIds = [...state.selectedGroupMembers];

  if (title.length < 2) {
    showToast('Группа', 'Введите название не короче 2 символов.');
    return;
  }

  if (participantIds.length < 2) {
    showToast('Группа', 'Выберите минимум 2 участников помимо себя.');
    return;
  }

  try {
    const chat = await api('/api/chats', {
      method: 'POST',
      body: JSON.stringify({
        type: 'group',
        title,
        avatar: state.selectedGroupAvatar,
        participantIds,
      }),
    });

    upsertChatSummary(chat);
    renderChatList();
    closeModal('group-modal');
    resetGroupModal();
    await openChat(chat.id);
    showToast('Готово', 'Группа создана.');
  } catch (error) {
    showToast('Ошибка', error.message);
  }
}

function bindEvents() {
  elements.loginBtn.addEventListener('click', handleLogin);
  elements.registerBtn.addEventListener('click', handleRegister);
  elements.logoutBtn.addEventListener('click', handleLogout);

  elements.authPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleLogin();
  });

  elements.chatSearch.addEventListener('input', renderChatList);
  elements.directUserSearch.addEventListener('input', renderDirectUserList);
  elements.groupUserSearch.addEventListener('input', renderGroupUserList);

  elements.openDirectModalBtn.addEventListener('click', () => {
    renderDirectUserList();
    openModal('direct-modal');
  });
  elements.emptyOpenDirectBtn.addEventListener('click', () => {
    renderDirectUserList();
    openModal('direct-modal');
  });

  elements.openGroupModalBtn.addEventListener('click', () => {
    resetGroupModal();
    openModal('group-modal');
  });
  elements.emptyOpenGroupBtn.addEventListener('click', () => {
    resetGroupModal();
    openModal('group-modal');
  });

  elements.createGroupBtn.addEventListener('click', handleCreateGroup);
  elements.sendBtn.addEventListener('click', handleSendMessage);

  elements.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    if (!state.activeChat) return;

    emitTyping(true);
    clearTimeout(state.typingStopTimer);
    state.typingStopTimer = setTimeout(() => emitTyping(false), 1200);
  });

  elements.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  });

  elements.messageInput.addEventListener('blur', () => emitTyping(false));
  elements.messageInput.addEventListener('focus', () => setStickerPickerVisible(false));
  elements.toggleDetailsBtn.addEventListener('click', toggleDetails);
  elements.mobileSidebarBtn.addEventListener('click', () => {
    if (elements.sidebar.classList.contains('visible')) {
      hideSidebar();
    } else {
      showSidebar();
    }
  });
  elements.sidebarBackdrop.addEventListener('click', hideSidebar);
  elements.attachFileBtn.addEventListener('click', () => {
    setStickerPickerVisible(false);
    elements.fileInput.click();
  });
  elements.recordVoiceBtn.addEventListener('click', async () => {
    await startRecording('voice');
  });
  elements.recordCircleBtn.addEventListener('click', async () => {
    await startRecording('video-note');
  });
  elements.openStickersBtn.addEventListener('click', () => {
    if (!state.activeChat) {
      showToast('Стикеры', 'Сначала откройте чат.');
      return;
    }
    setStickerPickerVisible(!state.stickerPickerVisible);
  });
  elements.clearFileBtn.addEventListener('click', clearSelectedFile);
  elements.fileInput.addEventListener('change', () => {
    const [file] = elements.fileInput.files || [];
    state.selectedFile = file || null;
    setStickerPickerVisible(false);
    renderSelectedFile();
  });
  elements.refreshChatBtn.addEventListener('click', async () => {
    if (!state.activeChat) return;
    await openChat(state.activeChat.id);
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (
      state.stickerPickerVisible
      && target instanceof Element
      && !elements.stickerPicker.contains(target)
      && target !== elements.openStickersBtn
      && !elements.openStickersBtn.contains(target)
    ) {
      setStickerPickerVisible(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      hideSidebar();
    }
    if (window.innerWidth > 1180) {
      state.detailsVisible = true;
      renderDetailsPanel();
    }
    if (window.innerWidth <= 1180 && state.detailsVisible && !state.activeChat) {
      state.detailsVisible = false;
    }
  });
}


async function bootstrap() {
  bootstrapAvatarPicker();
  renderGroupAvatarPicker();
  renderStickerPicker();
  bindEvents();
  renderSelectedFile();
  renderRecordingStatus();

  const rawUser = localStorage.getItem('messenger_user');
  if (!rawUser) {
    setScreen(false);
    return;
  }

  try {
    const user = JSON.parse(rawUser);
    setCurrentUser(user);
    await enterMessenger();
  } catch (error) {
    console.error(error);
    handleLogout();
  }
}

function bootstrapAvatarPicker() {
  renderAvatarSet(elements.avatarPicker, AVATARS, state.selectedAuthAvatar, (avatar) => {
    state.selectedAuthAvatar = avatar;
    bootstrapAvatarPicker();
  });
}

bootstrap();
