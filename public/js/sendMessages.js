/**
 * ===================================================================
 * sendMessages.js (MASTER FILE)
 *
 * This file controls all logic for the main chat interface.
 * It handles both 1-to-1 and Group chats using a hybrid
 * Socket.IO (real-time) and Axios (data-load) architecture.
 * ===================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // ================== DOM ELEMENTS ==================
  const chatList = document.querySelector(".chat-list-items");
  const chatBody = document.getElementById("chat-body");
  const chatInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const chatHeaderName = document.getElementById("chat-header-name");
  const chatHeaderImg = document.getElementById("chat-header-img");
  const attachFileBtn = document.getElementById("attach-file-btn");
  const chatFileInput = document.getElementById("chat-file-input");
  const groupManagementPanel = document.getElementById(
    "group-management-panel"
  );
  const emojiBtn = document.getElementById("emoji-btn");
  const sharedEmojiPicker = document.getElementById("shared-emoji-picker");
  const deleteModal = document.getElementById("delete-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const deleteForMeBtn = document.getElementById("delete-for-me-btn");
  const deleteForEveryoneBtn = document.getElementById(
    "delete-for-everyone-btn"
  );
  const chatViewContainer = document.getElementById("chat-view");
  const placeholder = document.querySelector(".main-placeholder");
  const container = document.querySelector(".container");
  const toast = document.getElementById("toast-notification");

  // ================== GLOBAL VARIABLES ==================

  // --- User & Chat State ---
  window.myUserId = null;
  window.currentChatUser = null; // The full object of the person/group we're talking to
  let currentChatType = "individual";
  window.chatItems = []; // Master list of all chats (users + groups)
  window.allUsers = []; // Global cache of user friends
  window.allGroups = []; // Global cache of user groups

  // --- Socket Connection ---
  let socket = null;
  const token = sessionStorage.getItem("token");

  // --- UI State & Timers ---
  let editingMessage = null;
  let messageToDelete = null;
  let currentSocketRoom = null;
  let typingTimer;
  let isTyping = false;
  const TYPING_TIMER_LENGTH = 1500;
  const usersTyping = new Map();
  let currentPickerMode = null;
  let currentMessageIdForReaction = null;
  let toastTimer;

  // ================== AUTHENTICATION ==================
  if (!token) {
    alert("You must be logged in to continue.");
    window.location.href = "/login";
    return;
  }

  // ================== UI HELPERS ==================
  /**
   * Displays a short-lived notification message on the screen.
   */
  window.showToast = (msg, isError = false) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = "show";
    if (isError) {
      toast.classList.add("error");
    }
    toastTimer = setTimeout(() => {
      toast.classList.remove("show", "error");
    }, 3000);
  };

  /**
   * Shows or hides the shared emoji picker.
   * @param {string} mode - 'composer' or 'reaction'.
   * @param {string} [messageId=null] - The message ID if mode is 'reaction'.
   */
  function togglePicker(mode, messageId = null) {
    if (
      sharedEmojiPicker.style.display === "block" &&
      currentPickerMode === mode
    ) {
      sharedEmojiPicker.style.display = "none";
      currentPickerMode = null;
    } else {
      sharedEmojiPicker.style.display = "block";
      currentPickerMode = mode;
      sharedEmojiPicker.classList.toggle("for-reactions", mode === "reaction");
      if (mode === "reaction") {
        currentMessageIdForReaction = messageId;
      }
    }
  }

  /**
   * Updates the text and class of the main chat header status.
   * @param {string|boolean} status - "typing...", true (online), or false (offline).
   */
  function updateHeaderStatus(status) {
    const headerStatusEl = document.getElementById("chat-header-status");
    const typingEl = document.getElementById("chat-header-typing");
    if (!headerStatusEl || !typingEl) return;

    typingEl.style.display = "none"; // Permanently hide the old typing element

    if (status === "typing...") {
      headerStatusEl.textContent = "typing...";
      headerStatusEl.className = "typing";
    } else if (status === true) {
      headerStatusEl.textContent = "online";
      headerStatusEl.className = "online";
    } else {
      headerStatusEl.textContent = "offline";
      headerStatusEl.className = "offline";
    }
  }

  /**
   * Updates a user's online/offline status in all necessary places.
   * @param {number} userId - The ID of the user.
   * @param {boolean} isOnline - True if they are online, false if offline.
   */
  function updateUserStatus(userId, isOnline) {
    // 1. UPDATE THE MASTER DATA ARRAY
    const chatItemInData = window.chatItems.find(
      (item) => item.id === userId && item.type === "individual"
    );
    if (chatItemInData) {
      chatItemInData.isOnline = isOnline;
    }

    // 2. UPDATE THE CHAT LIST DOM
    const chatItemEl = document.querySelector(
      `.chat[data-id='${userId}'][data-type='individual']`
    );
    if (chatItemEl) {
      if (isOnline) {
        chatItemEl.classList.add("online");
      } else {
        chatItemEl.classList.remove("online");
      }
    }

    // 3. UPDATE THE CURRENTLY OPEN CHAT
    if (
      currentChatType === "individual" &&
      window.currentChatUser &&
      window.currentChatUser.id === userId
    ) {
      window.currentChatUser.isOnline = isOnline;
      if (usersTyping.size === 0) {
        updateHeaderStatus(isOnline);
      }
    }
  }

  /**
   * Updates the "is typing..." text in the chat header.
   */
  function updateTypingIndicator() {
    const typers = Array.from(usersTyping.keys());
    if (typers.length > 0) {
      updateHeaderStatus("typing...");
    } else {
      // Restore the user's actual online/offline status
      updateHeaderStatus(window.currentChatUser?.isOnline);
    }
  }

  // ================== WEBSOCKET INITIALIZATION ==================
  /**
   * Connects to the Socket.IO server and registers all real-time event listeners.
   */
  function setupWebSocket() {
    socket = io(BASE_URL, {
      // BASE_URL is from config.js
      auth: {
        token: token,
      },
    });

    // --- Connection Events ---
    socket.on("connect", () => {
      console.log(`Connected to websocket server with ID: ${socket.id}`);
      // Tell server we are online
      socket.emit("goOnline");
    });

    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err.message);
      if (err.message === "Authentication error") {
        window.showToast("Authentication error. Please log in again.", true);
        sessionStorage.removeItem("token");
        window.location.href = "/login";
      }
    });

    socket.on("auth_error", (errorMsg) => {
      console.error("Websocket Auth Error:", errorMsg);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from websocket server.");
    });

    // --- Message Events ---
    socket.on("newMessage", (newMessage) => {
      if (newMessage.senderId === window.myUserId) return; // Ignore our own messages

      const isForCurrentChat =
        (currentChatType === "group" &&
          window.currentChatUser &&
          newMessage.groupId === window.currentChatUser.id) ||
        (currentChatType === "individual" &&
          window.currentChatUser &&
          newMessage.senderId === window.currentChatUser.id);

      if (isForCurrentChat) {
        appendMessage(newMessage);
        socket.emit("markChatAsRead", {
          chatId: window.currentChatUser.id,
          chatType: currentChatType,
        });
      }

      updateChatListLastMessage(newMessage);
    });

    socket.on("messageEdited", (updatedMessage) => {
      const messageEl = document.querySelector(
        `.message[data-message-id='${updatedMessage.id}']`
      );
      if (messageEl) {
        const messageContentEl = messageEl.querySelector(".message-content p");
        if (messageContentEl) {
          messageContentEl.textContent = updatedMessage.message;
        }
        if (window.currentChatUser && window.currentChatUser.messages) {
          const msgIndex = window.currentChatUser.messages.findIndex(
            (m) => m.id === updatedMessage.id
          );
          if (msgIndex > -1)
            window.currentChatUser.messages[msgIndex].message =
              updatedMessage.message;
        }
      }
    });

    socket.on("messageDeleted", ({ messageId }) => {
      const messageEl = document.querySelector(
        `.message[data-message-id='${messageId}']`
      );
      if (messageEl) {
        messageEl.remove();
      }
    });

    // --- Reaction Events ---
    socket.on("reactionAdded", ({ messageId, reaction, userId }) => {
      if (userId === window.myUserId) return;
      const messageEl = document.querySelector(
        `.message[data-message-id='${messageId}']`
      );
      if (!messageEl) return;
      let reactionsContainer = messageEl.querySelector(".message-reactions");
      if (!reactionsContainer) {
        reactionsContainer = document.createElement("div");
        reactionsContainer.className = "message-reactions";
        messageEl
          .querySelector(".message-content")
          .insertAdjacentElement("afterend", reactionsContainer);
      }
      let bubble = reactionsContainer.querySelector(
        `.reaction-bubble[data-reaction='${reaction}']`
      );
      if (bubble) {
        const countEl = bubble.querySelector(".reaction-count");
        countEl.textContent = parseInt(countEl.textContent) + 1;
      } else {
        bubble = document.createElement("div");
        bubble.className = "reaction-bubble";
        bubble.dataset.reaction = reaction;
        bubble.innerHTML = `<span>${reaction}</span><span class="reaction-count">1</span>`;
        reactionsContainer.appendChild(bubble);
      }
    });

    socket.on("reactionRemoved", ({ messageId, reaction, userId }) => {
      if (userId === window.myUserId) return;
      const messageEl = document.querySelector(
        `.message[data-message-id='${messageId}']`
      );
      if (!messageEl) return;
      const bubble = messageEl.querySelector(
        `.reaction-bubble[data-reaction='${reaction}']`
      );
      if (bubble) {
        const countEl = bubble.querySelector(".reaction-count");
        const newCount = parseInt(countEl.textContent) - 1;
        if (newCount > 0) {
          countEl.textContent = newCount;
        } else {
          bubble.remove();
        }
      }
    });

    // --- Status & Presence Events ---
    socket.on("onlineUserList", ({ userIds }) => {
      userIds.forEach((id) => updateUserStatus(id, true));
    });
    socket.on("userOnline", ({ userId }) => {
      updateUserStatus(userId, true);
    });
    socket.on("userOffline", ({ userId }) => {
      updateUserStatus(userId, false);
    });

    socket.on("userIsTyping", ({ chatId, userName }) => {
      if (window.currentChatUser && window.currentChatUser.id === chatId) {
        if (usersTyping.has(userName)) {
          clearTimeout(usersTyping.get(userName));
        }
        const timer = setTimeout(() => {
          usersTyping.delete(userName);
          updateTypingIndicator();
        }, 3000);
        usersTyping.set(userName, timer);
        updateTypingIndicator();
      }
    });

    socket.on("userStoppedTyping", ({ chatId, userName }) => {
      if (window.currentChatUser && window.currentChatUser.id === chatId) {
        if (usersTyping.has(userName)) {
          clearTimeout(usersTyping.get(userName));
          usersTyping.delete(userName);
          updateTypingIndicator();
        }
      }
    });

    socket.on("messagesRead", ({ chatId }) => {
      if (
        currentChatType === "individual" &&
        window.currentChatUser &&
        window.currentChatUser.id === chatId
      ) {
        const unreadMessages = document.querySelectorAll(
          ".message.sent:not(.read)"
        );
        unreadMessages.forEach((msgDiv) => {
          msgDiv.classList.add("read");
          const statusEl = msgDiv.querySelector(".message-status");
          if (statusEl) {
            statusEl.textContent = "✓✓";
            statusEl.classList.remove("sent", "sending");
            statusEl.classList.add("read");
          }
        });
      }
    });

    // --- Contact & Group List Sync Events ---
    socket.on("newFriendRequest", (senderData) => {
      window.showToast(`New friend request from ${senderData.name}`);
      const contactsBtn = document.getElementById("contacts-tab"); // Use the <li>
      if (contactsBtn) {
        contactsBtn.classList.add("has-notification"); // Add CSS for this
      }
    });

    socket.on("friendRequestAccepted", ({ message, newFriend }) => {
      window.showToast(message);
      window.allUsers.push(newFriend);
      window.chatItems.push(newFriend); // newFriend object is complete
      window.renderChatList();
    });

    socket.on("newFriendAdded", ({ message, newFriend }) => {
      window.showToast(message);
      window.allUsers.push(newFriend);
      window.chatItems.push(newFriend); // newFriend object is complete
      window.renderChatList();
    });

    socket.on("addedToGroup", (newGroup) => {
      window.showToast(`You've been added to the group: ${newGroup.name}`);
      window.allGroups.push(newGroup);
      window.chatItems.push(newGroup);
      window.renderChatList();
    });

    socket.on("removedFromGroup", ({ groupId, groupName }) => {
      window.showToast(`You have been removed from ${groupName}.`);
      window.chatItems = window.chatItems.filter(
        (item) => !(item.type === "group" && item.id === groupId)
      );
      window.allGroups = window.allGroups.filter(
        (group) => group.id !== groupId
      );
      window.renderChatList();
      if (
        currentChatType === "group" &&
        window.currentChatUser &&
        window.currentChatUser.id === groupId
      ) {
        chatViewContainer.classList.remove("active");
        placeholder.classList.add("active");
        window.currentChatUser = null;
        currentChatType = null;
      }
    });

    socket.on("unreadCountUpdate", ({ chatId, newCount }) => {
      const chatItemEl = document.querySelector(`.chat[data-id='${chatId}']`);
      if (!chatItemEl) return;
      let badge = chatItemEl.querySelector(".notification-badge");
      if (!badge && newCount > 0) {
        badge = document.createElement("span");
        badge.className = "notification-badge";
        chatItemEl.appendChild(badge);
      }
      if (newCount > 0 && badge) {
        badge.textContent = newCount;
        badge.style.display = "flex";
      } else if (badge) {
        badge.style.display = "none";
      }
    });
  } // --- End of setupWebSocket() ---

  // ================== AUTHENTICATION & INITIALIZATION ==================
  /**
   * Fetches the logged-in user's profile ID.
   */
  async function fetchCurrentUserId() {
    try {
      const response = await axios.get(`${BASE_URL}/api/user/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.myUserId = Number(response.data.userData.id);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      window.showToast("Authentication failed. Please log in again.", true);
      sessionStorage.removeItem("token");
      window.location.href = "/login";
      throw new Error("Auth Failed"); // Stop main() from continuing
    }
  }

  /**
   * Fetches all initial chat data (friends and groups).
   */
  async function fetchAndRenderFriends() {
    try {
      const [friendsResponse, groupsResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/contacts/friends`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BASE_URL}/api/group/fetch`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      // DEBUG: Check what we're actually receiving
      console.log("=== DEBUG FRIENDS DATA ===");
      console.log("Full friends response:", friendsResponse.data);

      if (
        friendsResponse.data.friends &&
        friendsResponse.data.friends.length > 0
      ) {
        console.log("First friend object:", friendsResponse.data.friends[0]);
        console.log(
          "First friend img value:",
          friendsResponse.data.friends[0].img
        );
        console.log("First friend name:", friendsResponse.data.friends[0].name);
      } else {
        console.log("No friends found in response");
      }

      // Assign to GLOBAL variables
      window.allUsers = friendsResponse.data.friends || [];
      window.allGroups = groupsResponse.data || [];

      // DEBUG: Check after assignment
      console.log("window.allUsers:", window.allUsers);

      // Map from GLOBAL variables
      const usersWithType = window.allUsers.map((u) => ({
        ...u,
        type: "individual",
      }));

      const groupsWithType = window.allGroups.map((g) => ({
        ...g,
        type: "group",
      }));

      // Set the master list
      window.chatItems = [...usersWithType, ...groupsWithType];

      // DEBUG: Check final chatItems
      console.log("window.chatItems:", window.chatItems);

      renderChatList();
    } catch (err) {
      console.error("Error initializing chat data:", err);
      window.showToast("Could not load your chats.", true);
    }
  }

  // ================== CHAT MANAGEMENT ==================
  /**
   * Renders the master chat list (friends and groups) to the UI.
   */
  window.renderChatList = () => {
    chatList.innerHTML = "";
    if (window.chatItems.length === 0) {
      chatList.innerHTML = `<li class="no-chats">No chats found.</li>`;
      return;
    }

    console.log("=== RENDERING CHAT LIST ===");

    window.chatItems.forEach((item, index) => {
      console.log(`Item ${index}:`, item.name, "img:", item.img);

      const li = document.createElement("li");
      li.className = "chat";
      li.dataset.id = item.id;
      li.dataset.type = item.type;
      li.dataset.name = item.name;

      // Calculate the image URL with proper fallback
      const userImg =
        item.img ||
        `https://placehold.co/50x50/695cfe/ffffff?text=${
          item.name ? item.name[0].toUpperCase() : "U"
        }`;
      li.dataset.img = userImg;

      console.log(`Final image URL for ${item.name}:`, userImg);

      // Get last message from the object
      const lastMessage = item.lastMessage || null;
      let lastMessageText = "No messages yet";
      if (lastMessage) {
        if (lastMessage.type === "text") {
          lastMessageText = lastMessage.message;
        } else if (
          lastMessage.type === "media" ||
          lastMessage.type === "image"
        ) {
          lastMessageText = "📷 Photo";
        } else if (lastMessage.type === "file") {
          lastMessageText = "📎 File";
        }
      }

      // Get unread count
      const unreadCount = item.unreadCount || 0;
      const badgeHTML =
        unreadCount > 0
          ? `<span class="notification-badge">${unreadCount}</span>`
          : "";

      li.innerHTML = `
      <img src="${userImg}" alt="${item.name}" class="chat-img" />
      <div class="chat-info">
        <h3 class="chat-name">${item.name}</h3>
        <p class="chat-message">${lastMessageText}</p>
      </div>
      ${badgeHTML}
    `;

      li.addEventListener("click", handleFriendClick);
      chatList.appendChild(li);
    });
  };

  /**
   * Click handler attached to each <li> in the chat list.
   */
  function handleFriendClick(event) {
    const chatItem = event.currentTarget;
    const chatId = Number(chatItem.dataset.id);
    const chatType = chatItem.dataset.type;

    const chatEntity = window.chatItems.find(
      (item) => item.id === chatId && item.type === chatType
    );
    if (!chatEntity) return;

    if (chatType === "individual") {
      selectChat(chatEntity);
    } else {
      openGroupChat(chatEntity);
    }
  }

  /**
   * Helper function to update the global last message for a chat item.
   */
  function updateChatListLastMessage(message) {
    const isGroup = !!message.groupId;
    const chatId = isGroup
      ? message.groupId
      : message.senderId === window.myUserId
      ? message.receiverId
      : message.senderId;

    if (!chatId) return;

    // 1. Update the master data array
    const chatItem = window.chatItems.find(
      (item) =>
        item.id === chatId && item.type === (isGroup ? "group" : "individual")
    );
    if (chatItem) {
      chatItem.lastMessage = message; // Store the new last message
    }

    // 2. Find the DOM element
    const chatItemEl = chatList.querySelector(`.chat[data-id='${chatId}']`);
    if (chatItemEl) {
      const lastMessageEl = chatItemEl.querySelector(".chat-message");
      let lastMessageText = "";
      if (message.type === "text") {
        lastMessageText = message.message;
      } else if (message.type === "media" || message.type === "image") {
        lastMessageText = "📷 Photo";
      } else if (message.type === "file") {
        lastMessageText = "📎 File";
      }
      lastMessageEl.textContent = lastMessageText;
      chatList.prepend(chatItemEl);
    }
  }

  /** Prepares to open a 1-to-1 chat. */
  const selectChat = async (userEntity) => {
    leaveCurrentChat();
    currentChatType = "individual";
    window.currentChatUser = userEntity;
    if (window.hideAdminFeatures) window.hideAdminFeatures();
    await openChat(userEntity);
  };

  /** Prepares to open a group chat. */
  const openGroupChat = async (groupEntity) => {
    leaveCurrentChat();
    currentChatType = "group";
    window.currentChatUser = groupEntity;
    if (window.initializeAdminFeatures)
      window.initializeAdminFeatures(groupEntity.id);
    await openChat(groupEntity);
  };

  /** The main function to open any chat. */
  const openChat = async (chatEntity) => {
    // 1. Set global state
    window.currentChatUser = chatEntity;
    currentChatType = chatEntity.type;
    usersTyping.clear();
    updateTypingIndicator();

    // 2. Update UI
    placeholder.classList.remove("active");
    chatViewContainer.classList.add("active");
    if (groupManagementPanel) groupManagementPanel.classList.remove("active");
    if (window.innerWidth <= 768) {
      container.classList.add("mobile-chat-active");
    }

    // 3. Manage Socket Rooms
    if (currentSocketRoom) {
      socket.emit("leaveGroup", { groupId: currentSocketRoom });
    }
    if (chatEntity.type === "group") {
      currentSocketRoom = `group_${chatEntity.id}`;
      socket.emit("joinGroup", { groupId: chatEntity.id });
    } else {
      currentSocketRoom = null;
    }

    // 4. Tell server we are viewing this chat (for unread counts)
    socket.emit("markChatAsRead", {
      chatId: chatEntity.id,
      chatType: chatEntity.type,
    });
    // Tell server we are viewing this chat (for "message read" status)
    socket.emit("userViewingChat", {
      chatId: chatEntity.id,
      chatType: currentChatType,
    });

    // 5. Optimistic UI: Hide badge on chat list
    const chatItemEl = document.querySelector(
      `.chat[data-id='${chatEntity.id}']`
    );
    if (chatItemEl) {
      const badge = chatItemEl.querySelector(".notification-badge");
      if (badge) badge.style.display = "none";
    }

    // 6. Populate Header & Clear Chat Body
    chatEntity.loadedAll = false;
    chatHeaderName.textContent = chatEntity.name;
    chatHeaderImg.src =
      chatEntity.img ||
      `https://placehold.co/50x50/695cfe/ffffff?text=${chatEntity.name[0].toUpperCase()}`;
    chatBody.innerHTML = ""; // Clear old messages
    updateHeaderStatus(chatEntity.isOnline); // Set initial online/offline status

    // 7. Fetch Message History
    try {
      const url = `${BASE_URL}/api/${
        chatEntity.type === "individual" ? "chat/fetch" : "group/messages"
      }/${chatEntity.id}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      chatEntity.messages = res.data || [];
      loadMessages(chatEntity.messages);
    } catch (err) {
      console.error("Error fetching messages:", err);
      chatBody.innerHTML =
        '<p class="empty-chat-message">Error loading messages.</p>';
    }
  };

  /**
   * Tells the server we are no longer viewing a specific chat.
   * This is for the "message read" status logic.
   */
  function leaveCurrentChat() {
    if (window.currentChatUser && socket) {
      socket.emit("userLeftChat");
    }
  }

  // Handle page unload (so server knows we're not viewing chat)
  window.addEventListener("beforeunload", leaveCurrentChat);

  // ================== MESSAGE DISPLAY ==================
  /** Clears the chat body and renders a new list of messages. */
  function loadMessages(messages) {
    chatBody.innerHTML = "";
    if (!messages || messages.length === 0) {
      chatBody.innerHTML =
        '<p class="empty-chat-message">No messages yet. Say hi!</p>';
      return;
    }
    messages.forEach((msg) => {
      appendMessage(msg, false);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /** Appends a new message to the bottom of the chat. */
  function appendMessage(msgObj, scroll = true) {
    if (document.querySelector(`.message[data-message-id='${msgObj.id}']`)) {
      return;
    }
    const placeholder = chatBody.querySelector(".empty-chat-message");
    if (placeholder) {
      placeholder.remove();
    }
    const messageElement = createMessageElement(msgObj);
    chatBody.appendChild(messageElement);
    if (scroll) {
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
  }

  /** Prepends an older message to the top of the chat (for infinite scroll). */
  function prependMessage(msgObj) {
    const messageElement = createMessageElement(msgObj);
    chatBody.prepend(messageElement);
  }

  /** The "factory" function that builds the HTML for a single message. */
  function createMessageElement(msgObj) {
    const isSent = msgObj.senderId === window.myUserId;
    const messageClass = isSent ? "sent" : "received";
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${messageClass}`;
    messageDiv.dataset.messageId = msgObj.id;

    // --- 1. Sender Name (for Groups) ---
    let senderNameHTML = "";
    if (!isSent && currentChatType === "group" && msgObj.Sender) {
      senderNameHTML = `<div class="message-sender-name">${msgObj.Sender.name}</div>`;
    }

    // --- 2. Time & Status Ticks ---
    const messageTime = new Date(msgObj.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    let statusHTML = "";
    if (isSent) {
      if (msgObj.status === "sending") {
        statusHTML = '<span class="message-status sending">🕒</span>';
      } else if (currentChatType === "individual" && msgObj.status === "read") {
        statusHTML = '<span class="message-status read">✓✓</span>';
      } else if (currentChatType === "individual" && msgObj.status === "sent") {
        statusHTML = '<span class="message-status sent">✓</span>';
      }
    }

    // --- 3. Reactions ---
    let reactionsHTML = "";
    const reactions =
      msgObj.MessageReactions || msgObj.GroupMessageReactions || [];
    if (reactions.length > 0) {
      const reactionGroups = reactions.reduce((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] || 0) + 1;
        return acc;
      }, {});
      reactionsHTML = `<div class="message-reactions">`;
      for (const [emoji, count] of Object.entries(reactionGroups)) {
        const userHasReacted = reactions.some(
          (r) => r.userId === window.myUserId && r.reaction === emoji
        );
        const reactedClass = userHasReacted ? "user-reacted" : "";
        reactionsHTML += `<div class...`;
      }
      reactionsHTML += `</div>`;
    }

    // --- 4. Edit/Delete Options ---
    let optionsHTML = "";
    if (isSent) {
      optionsHTML = `
        <div class="message-options">
          <button class="message-options-btn"><i class='bx bx-chevron-down'></i></button>
          <div class="message-menu">
            ${
              msgObj.type === "text"
                ? '<button class="edit-msg-btn">Edit</button>'
                : ""
            }
            <button class="delete-msg-btn">Delete</button>
          </div>
        </div>`;
    }

    // --- 5. Message Content (Text/Media/File) ---
    let contentHTML = ""; // If it's a received group message, add the sender's name
    if (!isSent && currentChatType === "group" && msgObj.Sender) {
      contentHTML += `<div class="message-sender-name">${msgObj.Sender.name}</div>`;
    } // Helper to build the full URL (THIS IS UNCHANGED)

    const getContentUrl = (contentPath) => {
      if (!contentPath) return "";
      if (typeof contentPath === "object" && contentPath.url) {
        contentPath = contentPath.url;
      }
      return contentPath.startsWith("http")
        ? contentPath
        : `${BASE_URL}${contentPath}`;
    }; // Get the Media object from the message

    // --- START OF FIX ---
    console.log("BUG HUNT: createMessageElement received:", msgObj);
    const mediaData = msgObj.Media || null;
    if (msgObj.type === "media" || msgObj.type === "image") {
      const imageUrl = getContentUrl(
        mediaData ? mediaData.url : msgObj.content
      );
      contentHTML += `<img src="${imageUrl}" class="chat-attached-image" alt="User uploaded image" />`;
    } else if (msgObj.type === "file") {
      console.log("BUG HUNT (File): msgObj.Media is:", mediaData);
      // Get URL and Filename from Media object
      const fileUrl = getContentUrl(mediaData ? mediaData.url : msgObj.content);
      const fileName = mediaData
        ? mediaData.originalName
        : fileUrl.split("/").pop();

      contentHTML += `
          <a href="${fileUrl}" target="_blank" class="file-message-container" download>
          <i class='bx bxs-file-blank file-icon'></i>
          <div class="file-info">
          <span class="file-name">${fileName}</span>
          </div>
          </a>`;
    } else {
      contentHTML = `<p>${msgObj.message}</p>`;
    }

    // --- 6. Assemble Final HTML ---
    const messageContentDiv = document.createElement("div");
    messageContentDiv.className = "message-content";
    messageContentDiv.innerHTML = `
        ${senderNameHTML} <!-- Sender name goes INSIDE the bubble -->
        ${contentHTML}
        <div class="message-meta">
          <span class="message-time">${messageTime}</span>
          ${statusHTML}
        </div>
    `;
    messageDiv.appendChild(messageContentDiv);
    messageDiv.insertAdjacentHTML("beforeend", reactionsHTML);
    messageDiv.insertAdjacentHTML("beforeend", optionsHTML);
    messageDiv.insertAdjacentHTML(
      "beforeend",
      `<button class="add-reaction-btn" aria-label="Add reaction"><i class='bx bx-smile'></i></button>`
    );

    // --- 7. Add Event Listeners for Options ---
    if (isSent) {
      const optionsBtn = messageDiv.querySelector(".message-options-btn");
      const menu = messageDiv.querySelector(".message-menu");
      optionsBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("active");
      });
      const editBtn = messageDiv.querySelector(".edit-msg-btn");
      editBtn?.addEventListener("click", () => {
        editingMessage = messageDiv;
        chatInput.value = msgObj.message;
        chatInput.focus();
        menu.classList.remove("active");
      });
      const deleteBtn = messageDiv.querySelector(".delete-msg-btn");
      deleteBtn?.addEventListener("click", () => {
        messageToDelete = messageDiv;
        deleteModal.classList.add("active");
        menu.classList.remove("active");
      });
    }
    return messageDiv;
  }

  // ================== MESSAGE SENDING/EDITING ==================
  /** Handles sending a new text message or editing an existing one. */
  async function processMessage() {
    const messageText = chatInput.value.trim();
    if (sendBtn.disabled) return;
    if (!window.currentChatUser) return;
    if (!messageText && !editingMessage) return;

    sendBtn.disabled = true;
    chatInput.disabled = true;

    if (editingMessage) {
      // --- EDIT LOGIC ---
      const messageId = parseInt(editingMessage.dataset.messageId);
      const payload = {
        messageId: messageId,
        message: messageText,
        chatType: currentChatType,
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
        ...(currentChatType === "group" && {
          groupId: window.currentChatUser.id,
        }),
      };
      socket.emit("editMessage", payload);
      const messageContentEl =
        editingMessage.querySelector(".message-content p");
      if (messageContentEl) messageContentEl.textContent = messageText;
      editingMessage = null;
    } else {
      // --- SEND LOGIC ---
      const tempId = `temp-${Date.now()}`;
      const messagePayload = {
        message: messageText,
        type: "text",
        tempId: tempId,
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
        ...(currentChatType === "group" && {
          groupId: window.currentChatUser.id,
        }),
      };
      const tempMessageObject = {
        id: tempId,
        senderId: window.myUserId,
        message: messageText,
        type: "text",
        createdAt: new Date().toISOString(),
        status: "sending",
        MessageReactions: [],
        GroupMessageReactions: [],
        Sender: { id: window.myUserId, name: "You" },
      };
      appendMessage(tempMessageObject);
      updateChatListLastMessage(tempMessageObject);

      socket.emit("sendMessage", messagePayload, (createdMessage) => {
        const tempMessageEl = document.querySelector(
          `[data-message-id='${tempId}']`
        );
        if (!tempMessageEl) return;
        if (createdMessage && !createdMessage.error) {
          tempMessageEl.dataset.messageId = createdMessage.id;
          const statusEl = tempMessageEl.querySelector(".message-status");
          if (statusEl) {
            if (currentChatType === "individual") {
              statusEl.textContent = "✓";
              statusEl.classList.remove("sending");
              statusEl.classList.add("sent");
            } else {
              statusEl.remove(); // No 'sent' tick for groups
            }
          }
          const msgIndex = window.currentChatUser.messages.findIndex(
            (m) => m.id === tempId
          );
          if (msgIndex > -1)
            window.currentChatUser.messages[msgIndex] = createdMessage;
        } else {
          tempMessageEl.classList.add("error");
          const statusEl = tempMessageEl.querySelector(".message-status");
          if (statusEl) statusEl.textContent = "Error";
          console.error(
            "Server failed to send message:",
            createdMessage?.error
          );
        }
      });
    }
    chatInput.value = "";
    isTyping = false;
    clearTimeout(typingTimer);
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }

  /** Helper to add file messages to the UI. */
  const handleSentOrEditedMessage = (msgObj) => {
    if (window.currentChatUser && window.currentChatUser.messages) {
      window.currentChatUser.messages.push(msgObj);
    }
    appendMessage(msgObj);
    updateChatListLastMessage(msgObj);
  };

  // ================== FILE UPLOAD ==================
  attachFileBtn.addEventListener("click", () => {
    chatFileInput.click();
  });

  chatFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || !window.currentChatUser) {
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    let url;
    if (currentChatType === "individual") {
      url = `${BASE_URL}/api/chat/add-file`;
      formData.append("receiverId", window.currentChatUser.id);
    } else {
      url = `${BASE_URL}/api/group/add-file`;
      formData.append("groupId", window.currentChatUser.id);
    }
    try {
      window.showToast("Uploading file...");
      const res = await axios.post(url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // The backend now sends the *full* message object, which
      // triggers the 'newMessage' socket event for everyone *including us*.
      // So, we don't need to call handleSentOrEditedMessage(res.data);
      // It will be handled by the 'newMessage' listener.
      //
      // BUT, let's call it just for the sender to be fast, and our
      // appendMessage function will block duplicates.
      handleSentOrEditedMessage(res.data);
    } catch (err) {
      console.error("Error uploading file:", err.response?.data || err.message);
      window.showToast(
        err.response?.data?.message || "File upload failed.",
        true
      );
    }
    e.target.value = "";
  });

  // ================== MESSAGE ACTIONS ==================
  async function addReaction(messageId, reaction) {
    // Optimistic UI is handled by the click listener
    const payload = {
      messageId: messageId,
      reaction: reaction,
      chatType: currentChatType,
      ...(currentChatType === "group" && {
        groupId: window.currentChatUser.id,
      }),
      ...(currentChatType === "individual" && {
        receiverId: window.currentChatUser.id,
      }),
    };
    socket.emit("addReaction", payload);
  }

  async function removeReaction(messageId, reaction) {
    // Optimistic UI is handled by the click listener
    const payload = {
      messageId: messageId,
      reaction: reaction,
      chatType: currentChatType,
      ...(currentChatType === "group" && {
        groupId: window.currentChatUser.id,
      }),
      ...(currentChatType === "individual" && {
        receiverId: window.currentChatUser.id,
      }),
    };
    socket.emit("removeReaction", payload);
  }

  const hideDeleteModal = () => {
    deleteModal.classList.remove("active");
    messageToDelete = null;
  };

  const deleteMessage = async (forEveryone) => {
    if (!messageToDelete) return;
    const messageId = parseInt(messageToDelete.dataset.messageId);

    // Optimistic UI
    messageToDelete.remove();

    const payload = {
      messageId: messageId,
      forEveryone: forEveryone,
      chatType: currentChatType,
      ...(forEveryone &&
        currentChatType === "group" && { groupId: window.currentChatUser.id }),
      ...(forEveryone &&
        currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
    };
    socket.emit("deleteMessage", payload);
    hideDeleteModal();
  };

  // ================== TYPING INDICATORS ==================
  chatInput.addEventListener("input", () => {
    if (!window.currentChatUser) return;
    if (!isTyping) {
      isTyping = true;
      const payload = {
        chatType: currentChatType,
        chatId: window.currentChatUser.id,
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
      };
      socket.emit("startTyping", payload);
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      const payload = {
        chatType: currentChatType,
        chatId: window.currentChatUser.id,
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
      };
      socket.emit("stopTyping", payload);
    }, TYPING_TIMER_LENGTH);
  });

  // ================== EVENT LISTENERS ==================
  sendBtn.addEventListener("click", processMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      processMessage();
    }
  });

  emojiBtn.addEventListener("click", () => {
    togglePicker("composer");
  });

  sharedEmojiPicker.addEventListener("emoji-click", async (event) => {
    const emoji = event.detail.unicode;
    if (currentPickerMode === "composer") {
      // Add emoji to the text input at cursor
      const start = chatInput.selectionStart;
      const end = chatInput.selectionEnd;
      chatInput.value =
        chatInput.value.substring(0, start) +
        emoji +
        chatInput.value.substring(end);
      chatInput.selectionStart = chatInput.selectionEnd = start + emoji.length;
      chatInput.focus();
    } else if (
      currentPickerMode === "reaction" &&
      currentMessageIdForReaction
    ) {
      // Find the bubble to see if we're adding or removing
      const messageEl = document.querySelector(
        `.message[data-message-id='${currentMessageIdForReaction}']`
      );
      const bubble = messageEl?.querySelector(
        `.reaction-bubble[data-reaction='${emoji}']`
      );

      if (bubble && bubble.classList.contains("user-reacted")) {
        await removeReaction(currentMessageIdForReaction, emoji);
        // Optimistic UI for removal
        const countEl = bubble.querySelector(".reaction-count");
        const currentCount = parseInt(countEl.textContent);
        if (currentCount <= 1) bubble.remove();
        else {
          countEl.textContent = currentCount - 1;
          bubble.classList.remove("user-reacted");
        }
      } else {
        await addReaction(currentMessageIdForReaction, emoji);
        // Optimistic UI for adding
        if (bubble) {
          // Bubble exists, just increment
          const countEl = bubble.querySelector(".reaction-count");
          countEl.textContent = parseInt(countEl.textContent) + 1;
          bubble.classList.add("user-reacted");
        } else {
          // New bubble
          let reactionsContainer =
            messageEl.querySelector(".message-reactions");
          if (!reactionsContainer) {
            /* create container */
          }
          const newBubble =
            document.createElement("div"); /* create new bubble */
          reactionsContainer.appendChild(newBubble);
        }
      }
    }
    sharedEmojiPicker.style.display = "none";
    currentPickerMode = null;
    currentMessageIdForReaction = null;
  });

  // Event delegation for reaction bubbles on the chat body
  chatBody.addEventListener("click", async (e) => {
    const addReactionBtn = e.target.closest(".add-reaction-btn");
    if (addReactionBtn) {
      const messageEl = addReactionBtn.closest(".message");
      togglePicker("reaction", messageEl.dataset.messageId);
      return;
    }

    const bubble = e.target.closest(".reaction-bubble");
    if (bubble) {
      const messageEl = bubble.closest(".message");
      const messageId = messageEl.dataset.messageId;
      const reaction = bubble.dataset.reaction;

      // Optimistic UI + API call
      if (bubble.classList.contains("user-reacted")) {
        // --- Remove Reaction ---
        const countEl = bubble.querySelector(".reaction-count");
        const currentCount = parseInt(countEl.textContent);
        if (currentCount <= 1) bubble.remove();
        else {
          countEl.textContent = currentCount - 1;
          bubble.classList.remove("user-reacted");
        }
        await removeReaction(messageId, reaction);
      } else {
        // --- Add Reaction ---
        const countEl = bubble.querySelector(".reaction-count");
        countEl.textContent = parseInt(countEl.textContent) + 1;
        bubble.classList.add("user-reacted");
        await addReaction(messageId, reaction);
      }
      return;
    }
  });

  // Infinite scroll
  chatViewContainer.addEventListener("scroll", async () => {
    if (
      chatViewContainer.scrollTop === 0 &&
      window.currentChatUser &&
      !window.currentChatUser.loadedAll
    ) {
      const firstMessageEl = chatBody.querySelector(".message");
      if (!firstMessageEl) return;
      const firstMessageId = firstMessageEl.dataset.messageId;
      if (firstMessageId.startsWith("temp-")) return; // Don't load if first msg is temp

      const oldScrollHeight = chatBody.scrollHeight;

      try {
        const url = `${BASE_URL}/api/${
          currentChatType === "individual" ? "chat/fetch" : "group/messages"
        }/${window.currentChatUser.id}?before=${firstMessageId}&limit=20`;

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const olderMessages = res.data || [];

        if (olderMessages.length === 0) {
          window.currentChatUser.loadedAll = true;
          return;
        }

        window.currentChatUser.messages.unshift(...olderMessages);
        olderMessages.reverse().forEach((msg) => prependMessage(msg));
        chatBody.scrollTop = chatBody.scrollHeight - oldScrollHeight;
      } catch (err) {
        console.error("Error loading older messages:", err);
      }
    }
  });

  // Global click handler (duplicate from top, but safe to have)
  document.addEventListener("click", (e) => {
    const isEmojiButton = e.target.closest("#emoji-btn");
    const isReactionButton = e.target.closest(".add-reaction-btn");
    const isInsidePicker = e.target.closest("#shared-emoji-picker");
    if (!isEmojiButton && !isReactionButton && !isInsidePicker) {
      if (sharedEmojiPicker.style.display === "block") {
        sharedEmojiPicker.style.display = "none";
        currentPickerMode = null;
      }
    }
    const openMenus = document.querySelectorAll(".message-menu.active");
    openMenus.forEach((menu) => {
      if (!menu.parentElement.contains(e.target)) {
        menu.classList.remove("active");
      }
    });
  });

  // Delete Modal Buttons
  cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  deleteForMeBtn.addEventListener("click", () => deleteMessage(false));
  deleteForEveryoneBtn.addEventListener("click", () => deleteMessage(true));

  // ================== RUN INITIALIZATION ==================
  async function main() {
    await fetchCurrentUserId();
    if (window.myUserId) {
      await fetchAndRenderFriends();
      setupWebSocket();
    }
  }

  main();
});
