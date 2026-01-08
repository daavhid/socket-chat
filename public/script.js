/* ============================================
   DOM ELEMENT REFERENCES
============================================ */
const userEl = document.getElementById('user');
const textEl = document.getElementById('text');
const sendBtn = document.getElementById('send-btn');
const chatBox = document.getElementById('chat-box');
const roomHeaderEl = document.getElementById('room-header');
const roomBtn = document.getElementById('room-btn');
const roomIdEl = document.getElementById('room-id');

const usernameGate = document.getElementById("username-gate");
const chatControls = document.getElementById("chat-controls");
const setUsernameBtn = document.getElementById("set-username-btn");
const leaveRoomBtn = document.getElementById("leave-room-btn");
const sidebar = document.getElementById("sidebar");
const displayUsername = document.getElementById("display-username");
const roomListContainer = document.getElementById("room-list");
const roomStatsElement = document.getElementById('room-stats-header');
const globalStatsElement = document.getElementById('global-stats-header');
const globalCountEl = document.getElementById("global-count");
const userTypingEl = document.getElementById("user-typing");

// Mobile elements
const MobileCountEl = document.getElementById("mobile-global-count");
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');
const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
const mobileSidebarContent = document.getElementById('mobile-sidebar-content');

/* ============================================
   SOCKET.IO SETUP & APPLICATION STATE
============================================ */
const socket = io({ autoConnect: false });
let joinedRoom = null;
let joinedRooms = []
let currentRoomCount = 0;
let roomMessages = {}; // Store messages per room

/* ============================================
   UTILITY FUNCTIONS
============================================ */

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).toLowerCase();
}

/* ============================================
   UI UPDATE FUNCTIONS
============================================ */

function setRoomHeader(text, mode = 'global') {
    roomHeaderEl.innerText = text;
    roomHeaderEl.className = `room-badge ${mode}`;
}

function updateRoomStats(count) {
    currentRoomCount = count;
    
    if (roomStatsElement && globalStatsElement) {
        if (joinedRoom) {
            // Show room stats, hide global stats
            roomStatsElement.innerHTML = `
                <i class="ph ph-users"></i>
                <span>${count}</span>
            `;
            roomStatsElement.style.display = 'flex';
            globalStatsElement.style.display = 'none';
        } else {
            // Hide room stats, show global stats
            roomStatsElement.style.display = 'none';
            globalStatsElement.style.display = 'flex';
        }
    }
}

/* ============================================
   MESSAGE HANDLING FUNCTIONS
============================================ */

function attachMessageTochat({ username, msg, type = "chat", roomId=null,}) {
    const messageEl = document.createElement("div");

    if (type === "system") {
        messageEl.className = "system-message";
        messageEl.textContent = msg;
        chatBox.appendChild(messageEl);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        // Store system message
        if (roomId || joinedRoom) {
            const room = roomId || joinedRoom;
            if (!roomMessages[room]) roomMessages[room] = [];
            roomMessages[room].push({ username: "system", msg, type: "system" });
        }
        return;
    }

    const isYou = username === userEl.value;
    messageEl.className = `message ${isYou ? "you" : "other"}`;
    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-username">${isYou ? "You" : username}</span>
            <span class="message-time">${formatTime()}</span>
        </div>
        <div class="message-content">${msg}</div>
    `;

    chatBox.appendChild(messageEl);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Store message for current room
    if (roomId || joinedRoom) {
        const room = roomId || joinedRoom;
        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push({ username, msg, type });
    }
}

function attachLoadMessageToChat({ username, msg, type = "chat" }) {
    const messageEl = document.createElement("div");

    if (type === "system") {
        messageEl.className = "system-message";
        messageEl.textContent = msg;
        chatBox.appendChild(messageEl);
        chatBox.scrollTop = chatBox.scrollHeight;
        return;
    }

    const isYou = username === userEl.value;
    messageEl.className = `message ${isYou ? "you" : "other"}`;
    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-username">${isYou ? "You" : username}</span>
            <span class="message-time">${formatTime()}</span>
        </div>
        <div class="message-content">${msg}</div>
    `;

    chatBox.appendChild(messageEl);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Load stored messages for a room
function loadRoomMessages(roomName) {
    console.log(roomName, roomMessages, 'this is the data in loadMessages');
    
    if (!roomMessages[roomName] || roomMessages[roomName].length === 0) {
        chatBox.innerHTML = '';
        return;
    }
    
    chatBox.innerHTML = '';
    roomMessages[roomName].forEach(msgData => {
        attachLoadMessageToChat(msgData);
    });
}

/* ============================================
   ROOM PREVIEW FUNCTIONS
============================================ */

// Show Room Preview Card
function showRoomPreview(roomName) {
    if (joinedRoom === roomName) {
        closeMobileSidebar();
        roomStatsElement.style.display = 'flex';
        loadRoomMessages(roomName);
        return;
    }

    chatBox.innerHTML += `
        <div class="room-preview-card">
            <div class="preview-icon"><i class="ph-fill ph-door-open"></i></div>
            <h2>Connect to ${roomName}</h2>
            <p style="margin-bottom:25px; color:#94a3b8;">You are viewing a channel preview. Join to start chatting with other members in this room.</p>
            <button class="join-prompt-btn" onclick="directJoin('${roomName}')">Join Room Now</button>
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
    
    roomIdEl.value = '';
    leaveRoomBtn.classList.add("hidden");
    
    // Close mobile sidebar if open
    closeMobileSidebar();
}

// Global scope helper for the inline button
window.directJoin = (name) => {
    textEl.value = '';
    socket.emit('typing', userEl.value, joinedRoom, textEl.value);
    joinRoom(name);
    closeMobileSidebar();
};

/* ============================================
   SIDEBAR ROOM LIST FUNCTIONS
============================================ */

function updateSidebarRooms(rooms) {
    // Update both desktop and mobile sidebars
    updateRoomList(roomListContainer, rooms);
    
    if (mobileSidebarContent) {
        const mobileRoomList = mobileSidebarContent.querySelector('.room-list');
        updateRoomList(mobileRoomList, rooms);
    }
}

function updateRoomList(container, rooms) {
    if (!container) return;
    
    container.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="room-item empty">No active rooms</div>';
        if (globalCountEl) globalCountEl.textContent = "0";
        return;
    }

    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <div style="font-weight:700;"># ${room.name}</div>
            <div class="room-stats">
                <i class="ph-fill ph-users"></i>
                <span>${room.count} online</span>
            </div>
        `;
        item.onclick = () => {
            console.log(joinedRooms, 'array');
            
            if (joinedRooms.includes(room.name)) {
                joinedRoom = room.name;
                roomStatsElement.style.display = 'flex';
                loadRoomMessages(room.name);
                closeMobileSidebar();
                return;
            }
            
            showRoomPreview(room.name);
        };
        container.appendChild(item);
    });
}

/* ============================================
   MOBILE SIDEBAR FUNCTIONS
============================================ */

function openMobileSidebar() {
    mobileSidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    mobileSidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

/* ============================================
   USER AUTHENTICATION FUNCTIONS
============================================ */

function setUinitialUsernameState() {
    userEl.value = '';
    usernameGate.classList.remove("hidden");
    chatControls.classList.add("hidden");
    sidebar.classList.add("hidden"); 
    displayUsername.textContent = ''; 
}

/* ============================================
   ROOM MANAGEMENT FUNCTIONS
============================================ */

function joinRoom(roomId) {
    socket.emit('join room request', {
        roomId,
        username: userEl.value,
    });
}

/* ============================================
   RESPONSIVE HANDLING FUNCTIONS
============================================ */

// Create room stats element for header
function createRoomStatsElement() {
    const header = document.querySelector('header');
    if (header && !header.querySelector('#room-stats-header')) {
        const roomStats = document.createElement('div');
        roomStats.id = 'room-stats-header';
        roomStats.className = 'room-stats-header hidden';
        roomStats.innerHTML = `
            <i class="ph ph-users"></i>
            <span>0</span>
        `;
        const headerInfo = header.querySelector('.header-info');
        if (headerInfo) {
            headerInfo.appendChild(roomStats);
        }
    }
}

// Handle window resize
function handleResize() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Hide desktop sidebar
        if (sidebar) sidebar.style.display = 'none';
        
        // Show/hide leave button based on screen size
        if (leaveRoomBtn) {
            // Don't override if hidden class is already set
            if (leaveRoomBtn.classList.contains('hidden')) {
                return; // Keep it hidden
            }
            if (window.innerWidth <= 360) {
                leaveRoomBtn.style.display = 'none';
            } else if (joinedRoom) {
                leaveRoomBtn.style.display = 'inline-flex';
            }
        }
        
        // Adjust chat box padding
        if (chatBox) {
            chatBox.style.padding = window.innerWidth <= 480 ? '12px' : '16px';
        }
    } else {
        // Show desktop sidebar
        if (sidebar) sidebar.style.display = 'flex';
        
        // Hide mobile sidebar if open
        closeMobileSidebar();
        
        // Show leave button normally on desktop
        if (leaveRoomBtn) {
            // Only manage display if button is not hidden by class
            if (!leaveRoomBtn.classList.contains('hidden')) {
                leaveRoomBtn.style.display = 'inline-flex';
            }
        }
    }
    
    // Reapply room stats display logic after resize
    if (joinedRoom) {
        updateRoomStats(currentRoomCount);
    }
}

/* ============================================
   EVENT LISTENERS SETUP
============================================ */

// Username Authentication
setUsernameBtn.addEventListener("click", () => {
    const name = userEl.value.trim();
    if (!name) return;

    usernameGate.classList.add("hidden");
    chatControls.classList.remove("hidden");
    sidebar.classList.remove("hidden"); 
    displayUsername.textContent = name; 
    
    // Update mobile sidebar username if it exists
    const mobileDisplayUsername = document.getElementById('mobile-display-username');
    if (mobileDisplayUsername) {
        mobileDisplayUsername.textContent = name;
    }

    socket.connect();
    socket.emit('send username', name);
    attachMessageTochat({ 
        type: "system", 
        msg: `Logged in as ${name}. Welcome to the Lobby.`, 
        roomId: 'global' 
    });
});

// Room Join Button
roomBtn.addEventListener('click', () => {
    const roomId = roomIdEl.value.trim();
    if (!roomId) return;
    
    if (joinedRooms.includes(roomId)) {
        loadRoomMessages(roomId);
        return;
    }
    
    socket.emit('room availability', roomId);
    socket.on('room availability', (isAvailable) => {
        if (!isAvailable) {
            setRoomHeader('Room not available', 'error');
            setTimeout(() => setRoomHeader("Global Lobby", "global"), 2000);
            return;
        }
        showRoomPreview(roomId);
    });
    
    roomIdEl.value = '';
});

// Leave Room Button
leaveRoomBtn.addEventListener("click", () => {
    socket.emit('typing', userEl.value, joinedRoom, textEl.value);
    socket.emit("leave room", joinedRoom, userEl.value);
    
    joinedRooms.splice(joinedRooms.indexOf(joinedRoom), 1);
    
    if (roomMessages[joinedRoom]) {
        delete roomMessages[joinedRoom];
        console.log(roomMessages, joinedRoom, 'new room message');
    }
    
    joinedRoom = "";
    setRoomHeader("Global Lobby", "global");
    loadRoomMessages('global');
    leaveRoomBtn.classList.add("hidden");
    
    // Hide room stats
    updateRoomStats(0);
});

// Send Message Button
sendBtn.addEventListener('click', () => {
    if (!textEl.value.trim()) return;

    const message = {
        username: userEl.value,
        msg: textEl.value,
        hasRoom: Boolean(joinedRoom),
        roomId: joinedRoom,
    };

    socket.emit('send message', message);
    textEl.value = '';
    socket.emit('typing', userEl.value, joinedRoom, textEl.value);
});

// Enter Key Listeners
textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

roomIdEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        roomBtn.click();
    }
});

userEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        setUsernameBtn.click();
    }
});

// Typing Indicator
textEl.addEventListener('input', () => {
    console.log(userEl.value, joinedRoom, 'this is the value when they have joined');
    socket.emit('typing', userEl.value, joinedRoom, textEl.value);
});

/* ============================================
   MOBILE SIDEBAR EVENT LISTENERS
============================================ */

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openMobileSidebar);
}

if (mobileSidebarClose) {
    mobileSidebarClose.addEventListener('click', closeMobileSidebar);
}

if (mobileSidebarOverlay) {
    mobileSidebarOverlay.addEventListener('click', (e) => {
        if (e.target === mobileSidebarOverlay) {
            closeMobileSidebar();
        }
    });
}

/* ============================================
   SOCKET.IO EVENT HANDLERS
============================================ */

// User count updates
socket.on('total online', (totalOnline) => {
    if (globalCountEl) globalCountEl.textContent = totalOnline;
    if (MobileCountEl) MobileCountEl.textContent = totalOnline;
    
    if (!joinedRoom) {
        globalStatsElement.innerHTML = `
            <i class="ph ph-users"></i>
            <span>${totalOnline}</span>
        `;
        globalStatsElement.style.display = 'flex';
    }
});

// User connection events
socket.on('retrieve username', (username) => {
    attachMessageTochat({
        type: 'system',
        msg: `${username} joined the application`,
        roomId: "global",
    });
});

socket.on('user disconnected', (username) => {
    attachMessageTochat({
        type: 'system',
        msg: `${username} left the application`,
        roomId: 'global'
    });
    
    if (username === userEl.value) {
        setUinitialUsernameState();
    }
});

// Room events
socket.on('leave room', ({ username, roomId }) => {
    attachMessageTochat({ 
        type: "system", 
        msg: `${username === userEl.value ? "You" : username} left #${roomId}`, 
        roomId 
    });
});

socket.on('join room', ({ hasRoom, roomId, roomCount = 0 }) => {
    if (!hasRoom) {
        setRoomHeader('Room not available', 'error');
        setTimeout(() => setRoomHeader("Global Lobby", "global"), 2000);
        return;
    }
    
    joinedRoom = roomId;
    joinedRooms.push(joinedRoom);
    userTypingEl.innerText = '';
    
    chatBox.innerHTML = ""; // Clear preview/previous chat
    setRoomHeader(`Channel: ${joinedRoom}`, 'active');
    leaveRoomBtn.classList.remove("hidden");
    
    // Update room stats
    updateRoomStats(roomCount);
});

socket.on('rooms', (rooms) => {
    updateSidebarRooms(rooms);
    
    // Update current room count if we're in a room
    if (joinedRoom) {
        const currentRoom = rooms.find(room => room.name === joinedRoom);
        if (currentRoom) {
            updateRoomStats(currentRoom.count);
        }
    }
});

// Message events
socket.on('global chat', (message) => {
    if (!joinedRoom) {
        attachMessageTochat({ 
            username: message.username, 
            msg: message.msg, 
            roomId: 'global' 
        });
    }
});

socket.on('join chat', (message) => {
    if (joinedRoom) {
        attachMessageTochat({ 
            username: message.username, 
            msg: message.msg, 
            roomId: joinedRoom 
        });
    }
});

socket.on("joined room", ({ roomId, username, roomCount }) => {
    attachMessageTochat({
        type: "system",
        msg: `${username === userEl.value ? "You" : username} joined #${roomId}`,
        roomId,
    });
    
    if (roomId === joinedRoom) {
        updateRoomStats(roomCount);
    }
});

socket.on('room log', ({ roomId, username, status }) => {
    attachMessageTochat({
        type: "system",
        msg: `${username === userEl.value ? "You" : username} ${status} #${roomId}`,
        roomId
    });
});

socket.on('typing', (username, textElVal) => {
    console.log(username, textElVal, 'the user is typing');
    
    if (textElVal === '') {
        console.log('now here in the if block');
        userTypingEl.innerText = '';
    } else {
        userTypingEl.innerText = `${username} is typing...`;
    }
});

/* ============================================
   INITIALIZATION
============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Create room stats element
    createRoomStatsElement();
    
    // Focus on username input
    setTimeout(() => {
        if (userEl) userEl.focus();
    }, 300);
    
    // Initial resize handling
    handleResize();
});

// Listen for resize
window.addEventListener('resize', handleResize);

// Close sidebar with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileSidebarOverlay.classList.contains('active')) {
        closeMobileSidebar();
    }
});

// Prevent zoom on mobile input focus
document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }
}, false);

// Restore zoom when input loses focus
document.addEventListener('blur', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(function() {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.content = 'width=device-width, initial-scale=1.0';
            }
        }, 100);
    }
});