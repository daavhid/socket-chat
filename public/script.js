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
const globalCountEl = document.getElementById("global-count");

// Mobile elements
const MobileCountEl = document.getElementById("mobile-global-count");
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');
const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
const mobileSidebarContent = document.getElementById('mobile-sidebar-content');

const socket = io({ autoConnect: false });
let joinedRoom = null;
let currentRoomCount = 0;
let roomMessages = {}; // Store messages per room

/* -----------------------------
   UI RENDERING HELPERS
--------------------------------*/

function setRoomHeader(text, mode = 'global') {
    roomHeaderEl.innerText = text;
    roomHeaderEl.className = `room-badge ${mode}`;
}

function updateRoomStats(count) {
    currentRoomCount = count;
    
    
    if (roomStatsElement) {
        if (joinedRoom) {
            roomStatsElement.innerHTML = `
                <i class="ph ph-users"></i>
                <span>${count}</span>
            `;
            roomStatsElement.style.display = 'flex';
        } else {
            roomStatsElement.style.display = 'none';
        }
    }
}

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).toLowerCase();
}

function attachMessageTochat({ username, msg, type = "chat", roomId = 'global',}) {
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
    if (!roomMessages[roomName] || roomMessages[roomName].length === 0) {
        chatBox.innerHTML = '';
        return;
    }
    chatBox.innerHTML = '';
    roomMessages[roomName].forEach(msgData => {
        attachLoadMessageToChat(msgData);
    });
}

// NEW: Show Room Preview Card
function showRoomPreview(roomName) {
    if (joinedRoom === roomName) {
        closeMobileSidebar()
        loadRoomMessages(roomName)
        // leaveRoomBtn.classList.remove("hidden");
        return

    }; // Already in it

    chatBox.innerHTML = `
        <div class="room-preview-card">
            <div class="preview-icon"><i class="ph-fill ph-door-open"></i></div>
            <h2>Connect to ${roomName}</h2>
            <p style="margin-bottom:25px; color:#94a3b8;">You are viewing a channel preview. Join to start chatting with other members in this room.</p>
            <button class="join-prompt-btn" onclick="directJoin('${roomName}')">Join Room Now</button>
        </div>
    `;
    
    // UI Feedback: Show user we are focused on this room
    roomIdEl.value = '';
    leaveRoomBtn.classList.add("hidden");
    roomStatsElement.style.display = 'none';
    
    
    // Close mobile sidebar if open
    closeMobileSidebar();
}

// Global scope helper for the inline button
window.directJoin = (name) => {
    joinRoom(name);
    closeMobileSidebar();
};

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
        return
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
            if(roomMessages[room.name]){
                joinedRoom = room.name
                loadRoomMessages(room.name)
                closeMobileSidebar()
                return
            }
            showRoomPreview(room.name)
        };
        container.appendChild(item);
    });
    
}

socket.on('total online',(totalOnline)=>{
if (globalCountEl) globalCountEl.textContent = totalOnline;
if (MobileCountEl) {
    MobileCountEl.textContent = totalOnline
};
})


function createMobileSidebarContent() {
    // Clone the sidebar content for mobile
    
    // Update the mobile username display
    const mobileDisplayUsername = document.getElementById('mobile-display-username');
    if (mobileDisplayUsername && userEl.value) {
        mobileDisplayUsername.textContent = userEl.value;
    }
    
    return mobileSidebarContent.querySelector('.room-list');
}

/* -----------------------------
   MOBILE SIDEBAR HANDLING
--------------------------------*/

function openMobileSidebar() {
    mobileSidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    mobileSidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Initialize mobile sidebar
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

// Close sidebar with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileSidebarOverlay.classList.contains('active')) {
        closeMobileSidebar();
    }
});

/* -----------------------------
   AUTH FLOW
--------------------------------*/

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

    socket.connect()
    socket.emit('send username', name);
    attachMessageTochat({ type: "system", msg: `Logged in as ${name}. Welcome to the Lobby.` });
});

socket.on('retrieve username',(username)=>{
    attachMessageTochat({
        type:'system',
        msg:`${username} joined the application`
    })
})

socket.on('user disconnected',(username)=>{
    attachMessageTochat({
        type:'system',
        msg:`${username} left the application`
    })
})

/* -----------------------------
   ROOM LOGIC
--------------------------------*/

function joinRoom(roomId) {
    socket.emit('join room request', {
        roomId,
        username: userEl.value,
    });
}

roomBtn.addEventListener('click', () => {
    const roomId = roomIdEl.value.trim();
    if (!roomId) return;
    if(roomMessages[roomId]){
        loadRoomMessages(roomId)
        return
    }
    socket.emit('room availability',roomId);
    socket.on('room availability',(isAvailable)=>{
        if (!isAvailable) {
            setRoomHeader('Room not available', 'error');
            setTimeout(() => setRoomHeader("Global Lobby", "global"), 2000);
            return;
        }
        showRoomPreview(roomId)
    })
    roomIdEl.value = '';
    
});


leaveRoomBtn.addEventListener("click", () => {
    socket.emit("leave room", joinedRoom, userEl.value);
    joinedRoom = "";
    setRoomHeader("Global Lobby", "global");
    loadRoomMessages('global')
    leaveRoomBtn.classList.add("hidden");
    
    // Hide room stats
    updateRoomStats(0);
    
});

socket.on('leave room',({username,roomId})=>{
        attachMessageTochat({ type: "system", msg: `${username === userEl.value ? "You" : username} left #${roomId}`});

})

socket.on('join room', ({ hasRoom, roomId, roomCount = 0 }) => {
    
    if (!hasRoom) {
        setRoomHeader('Room not available', 'error');
        setTimeout(() => setRoomHeader("Global Lobby", "global"), 2000);
        return;
    }
    
    joinedRoom = roomId;
    
    // Load stored messages if they exist, otherwise clear the chat
    if (roomMessages[joinedRoom] && roomMessages[joinedRoom].length > 0) {
        loadRoomMessages(joinedRoom);
    } else {
        chatBox.innerHTML = ""; // Clear preview/previous chat
    }
    
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

/* -----------------------------
   MESSAGE LOGIC
--------------------------------*/

// Send message on button click
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
});

// Send message on Enter key
textEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Join room on Enter key in room ID input
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

socket.on('global chat', (message) => {
    if (!joinedRoom) attachMessageTochat({ username: message.username, msg: message.msg });
});

socket.on('join chat', (message) => {
    if (joinedRoom) attachMessageTochat({ username: message.username, msg: message.msg });
});

socket.on("joined room", ({ roomId, username, roomCount }) => {
    attachMessageTochat({
        type: "system",
        msg: `${username === userEl.value ? "You" : username} joined #${roomId}`
    });
    
    if (roomId === joinedRoom) {
        updateRoomStats(roomCount);
    }
});

socket.on('room log',({ roomId, username, status })=>{
    attachMessageTochat({
        type: "system",
        msg: `${username === userEl.value ? "You" : username} ${status} #${roomId}`
    });
})

socket.on("left room", ({ roomId, roomCount }) => {
    if (roomId === joinedRoom) {
        updateRoomStats(roomCount);
    }
});

/* -----------------------------
   RESPONSIVE HANDLING
--------------------------------*/

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
        
        // Show/hide room stats based on screen size
        const roomStats = document.getElementById('room-stats-header');
        if (roomStats) {
            if (window.innerWidth <= 480) {
                roomStats.style.display = 'flex';
            } else {
                roomStats.style.display = 'flex' ;
            }
        }
        
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
        
        // Show room stats in sidebar instead of header
        const roomStats = document.getElementById('room-stats-header');
        if (roomStats) {
            roomStats.style.display = 'none';
        }
        
        // Show leave button normally on desktop
        if (leaveRoomBtn) {
            // Only manage display if button is not hidden by class
            if (!leaveRoomBtn.classList.contains('hidden')) {
                leaveRoomBtn.style.display = 'inline-flex';
            }
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Create room stats element
    createRoomStatsElement();
    
    // Focus on username input
    setTimeout(() => {
        if (userEl) userEl.focus();
    }, 300);
    
    // Initial resize handling
    handleResize();
    
    // Create mobile sidebar content
    // createMobileSidebarContent();
});

// Listen for resize
window.addEventListener('resize', handleResize);

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