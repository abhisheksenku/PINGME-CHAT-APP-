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
  window.myUserId = null; // The logged-in user's ID
  window.currentChatUser = null; // The full object of the person/group we're talking to
  let currentChatType = "individual"; // 'individual' or 'group'
  window.chatItems = []; // Master list of all chats (users + groups)
  window.allUsers = []; // Make sure this is on the window
  window.allGroups = [];
  // --- Socket Connection ---
  let socket = null; // This will hold our WebSocket connection
  const token = sessionStorage.getItem("token"); // Auth token

  // --- UI State & Timers ---
  let editingMessage = null; // The message <div> being edited
  let messageToDelete = null; // The message <div> to be deleted
  let currentSocketRoom = null; // The current group room (e.g., 'group-123')
  let typingTimer; // Timer for typing detection
  let isTyping = false; // Whether user is currently typing
  const TYPING_TIMER_LENGTH = 1500; // 1.5 seconds
  const usersTyping = new Map(); // Map of users currently typing in a group
  let currentPickerMode = null; // 'composer' or 'reaction'
  let currentMessageIdForReaction = null; // Message ID for reaction picker

  // ================== WEBSOCKET INITIALIZATION ==================

  // ================== AUTHENTICATION & INITIALIZATION ==================
  if (!token) {
    alert("Please login");
    return;
  }
  /**
   * 1. Fetches the logged-in user's profile ID.
   * This is the first and most critical step.
   */
  async function fetchCurrentUserId() {
    try {
      const response = await axios.get(`${BASE_URL}/api/user/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Store the ID in the global variable
      window.myUserId = Number(response.data.userData.id);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      // If the token is bad, redirect to login
      window.showToast("Authentication failed. Please log in again.", true);
      sessionStorage.removeItem("token");
      window.location.href = "/login"; // Or your login page
    }
  }
  /**
   * 2. Fetches all initial chat data (friends and groups).
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
      console.log(
        "🔵 FETCH: Raw data from /api/contacts/friends:",
        friendsResponse.data.friends
      );

      // --- START OF FIX ---

      // 1. Assign to the GLOBAL variables
      window.allUsers = friendsResponse.data.friends || [];
      window.allGroups = groupsResponse.data || [];

      // 2. Log the GLOBAL variables
      console.log("👥 Raw friends data:", window.allUsers);
      console.log("👥 Raw groups data:", window.allGroups);
      console.log("🔍 DEBUG - First friend details:", window.allUsers[0]);
      console.log("🔍 DEBUG - First friend messages:", window.allUsers[0]?.messages);
      console.log("🔍 DEBUG - First friend lastMessage:", window.allUsers[0]?.lastMessage);

      // 3. Map from the GLOBAL variables
      const usersWithType = window.allUsers.map((u) => ({
        ...u,
        type: "individual",
        messages: Array.isArray(u.messages) ? u.messages : [],
        unreadCount: u.unreadCount || 0,
      }));

      const groupsWithType = window.allGroups.map((g) => ({
        ...g,
        type: "group",
        messages: Array.isArray(g.messages) ? g.messages : [],
        unreadCount: g.unreadCount || 0,
      }));

      // 4. Set the master list
      window.chatItems = [...usersWithType, ...groupsWithType];
      
      // 5. DO NOT re-assign the empty local variables back to the window
      
      // --- END OF FIX ---

      renderChatList();
    } catch (err) {
      console.error("Error initializing chat data:", err);
      window.showToast("Could not load your chats.", true);
    }
  }
  // Render chat list
  /**
   * 3. Renders the master chat list (friends and groups) to the UI.
   * This is the "final" version that includes last message logic and unread badges.
   */
  window.renderChatList = () => {
    chatList.innerHTML = "";

    if (window.chatItems.length === 0) {
      chatList.innerHTML = `<li class="no-chats">No chats found.</li>`;
      return;
    }

    console.log("📋 All chat items:", window.chatItems); // Debug log

    window.chatItems.forEach((item) => {
      console.log(`🔍 Processing chat ${item.id}:`, item); // Debug log

      const li = document.createElement("li");
      li.className = "chat";
      li.dataset.id = item.id;
      li.dataset.type = item.type;
      li.dataset.name = item.name;
      li.dataset.img =
        item.img ||
        `https://placehold.co/50x50/695cfe/ffffff?text=${item.name[0].toUpperCase()}`;

      // Debug the messages array
      console.log(`💬 Messages for ${item.name}:`, item.messages);

      const lastMessage = item.lastMessage || null;
      console.log(`📝 Last message for ${item.name}:`, lastMessage); // Debug log

      let lastMessageText = "No messages yet";
      if (lastMessage) {
        console.log(`🔍 Last message type: ${lastMessage.type}`); // Debug log

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

      const unreadCount = item.unreadCount || 0;
      console.log(
        `🎨 CLIENT: Rendering chat ${item.name}, Initial Unread: ${unreadCount}`
      );
      const badgeHTML =
        unreadCount > 0
          ? `<span class="notification-badge">${unreadCount}</span>`
          : "";

      console.log(`🔔 Unread count for ${item.name}: ${unreadCount}`); // Debug log

      li.innerHTML = `
      <img src="${li.dataset.img}" alt="${item.name}" class="chat-img" />
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

  // ================== CHAT MANAGEMENT ==================
  /**
   * This is the main click handler added to each chat item in the list.
   * It reads the data from the clicked <li> and calls the correct function.
   */
  function handleFriendClick(event) {
    // 'currentTarget' refers to the <li> we added the listener to
    const chatItem = event.currentTarget;

    // Get the ID and type we stored in the dataset
    const chatId = Number(chatItem.dataset.id);
    const chatType = chatItem.dataset.type;

    // Find the full chat object from our global 'chatItems' array
    const chatEntity = window.chatItems.find(
      (item) => item.id === chatId && item.type === chatType
    );

    if (!chatEntity) {
      console.error(
        "Could not find chat item in global list:",
        chatId,
        chatType
      );
      return;
    }

    // Call the correct function based on the type
    if (chatType === "individual") {
      selectChat(chatEntity);
    } else {
      openGroupChat(chatEntity);
    }
  }

  /**
   * Prepares to open a 1-to-1 chat.
   * It sets the global state and tells admin.js to hide group features.
   */
  const selectChat = async (userEntity) => {
    leaveCurrentChat();
    currentChatType = "individual";
    window.currentChatUser = userEntity; // Set the global chat user

    // Call helper from admin.js to hide group buttons
    if (window.hideAdminFeatures) {
      window.hideAdminFeatures();
    }

    await openChat(userEntity);
  };

  /**
   * Prepares to open a group chat.
   * It sets the global state and tells admin.js to show group features.
   */
  const openGroupChat = async (groupEntity) => {
    leaveCurrentChat();
    currentChatType = "group";
    window.currentChatUser = groupEntity; // Set the global chat user

    // Call helper from admin.js to check if we are an admin
    if (window.initializeAdminFeatures) {
      window.initializeAdminFeatures(groupEntity.id);
    }

    await openChat(groupEntity);
  };

  /**
   * The main function to open any chat, fetch messages, and set up sockets.
   * This is called by selectChat() or openGroupChat().
   */
  const openChat = async (chatEntity) => {
    console.log(
      `⚪️ OPEN_CHAT: Opening chat with ${chatEntity.name}. Their status is: ${chatEntity.isOnline}`
    );
    // --- 1. SET GLOBAL STATE & UI ---
    window.currentChatUser = chatEntity;
    currentChatType = chatEntity.type;

    // Reset typing indicators
    usersTyping.clear();
    // updateTypingIndicator(); // We'll write this later

    // Show the chat window and hide the placeholder
    placeholder.classList.remove("active");
    chatViewContainer.classList.add("active");
    groupManagementPanel.classList.remove("active"); // Hide admin panel

    // Handle mobile view
    if (window.innerWidth <= 768) {
      container.classList.add("mobile-chat-active");
    }

    // --- 2. MANAGE SOCKET ROOMS (NEW) ---
    // Leave the previous group room if we were in one
    if (currentSocketRoom) {
      socket.emit("leaveGroup", { groupId: currentSocketRoom });
      console.log(`Left room: ${currentSocketRoom}`);
    }

    // Join a new room if this is a group
    if (chatEntity.type === "group") {
      currentSocketRoom = `group-${chatEntity.id}`;
      socket.emit("joinGroup", { groupId: chatEntity.id });
      console.log(`Joined room: ${currentSocketRoom}`);
    } else {
      currentSocketRoom = null; // We are in a 1-to-1 chat
    }

    // --- 3. MARK AS READ (NEW) ---
    socket.emit("markChatAsRead", {
      chatId: chatEntity.id,
      chatType: chatEntity.type,
    });
    socket.emit("userViewingChat", {
      chatId: chatEntity.id,
      chatType: currentChatType,
    });

    // Optimistic UI: Hide the badge on the chat list
    const chatItemEl = document.querySelector(
      `.chat[data-id='${chatEntity.id}']`
    );
    if (chatItemEl) {
      const badge = chatItemEl.querySelector(".notification-badge");
      if (badge) {
        badge.style.display = "none";
      }
    }

    // --- 4. POPULATE HEADER & CLEAR CHAT ---
    chatEntity.loadedAll = false; // For infinite scroll
    chatHeaderName.textContent = chatEntity.name;
    chatHeaderImg.src =
      chatEntity.img ||
      `https://placehold.co/50x50/695cfe/ffffff?text=${chatEntity.name[0].toUpperCase()}`;
    chatBody.innerHTML = ""; // Clear old messages
    updateHeaderStatus(chatEntity.isOnline);
    // --- 5. FETCH MESSAGE HISTORY ---
    try {
      // Build the correct URL based on chat type
      const url = `${BASE_URL}/api/${
        chatEntity.type === "individual" ? "chat/fetch" : "group/messages"
      }/${chatEntity.id}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      chatEntity.messages = res.data || [];
      loadMessages(chatEntity.messages); // Call the next function we'll write
    } catch (err) {
      console.error("Error fetching messages:", err);
      chatBody.innerHTML =
        '<p class="empty-chat-message">Error loading messages.</p>';
    }
  };
  // Also handle when user manually closes chat
  function leaveCurrentChat() {
    if (window.currentChatUser) {
      socket.emit("userLeftChat");
      console.log("Left chat:", window.currentChatUser.id);
    }
  }

  // Handle page unload
  window.addEventListener("beforeunload", leaveCurrentChat);
  /**
   * Finds a chat in the sidebar, updates its "last message" preview,
   * and moves the chat item to the top of the list.
   */
  function updateChatListLastMessage(message) {
    // Determine the chat ID.
    // If it's a group, use groupId.
    // If 1-to-1, use the *other* person's ID (not our own).
    const chatId = message.groupId
      ? message.groupId
      : message.senderId === window.myUserId
      ? message.receiverId
      : message.senderId;

    if (!chatId) return; // Should not happen

    // Find the chat item element in the list
    const chatItemEl = chatList.querySelector(`.chat[data-id='${chatId}']`);

    if (chatItemEl) {
      const lastMessageEl = chatItemEl.querySelector(".chat-message");

      // Set the preview text based on message type
      let lastMessageText = "";
      if (message.type === "text") {
        lastMessageText = message.message;
      } else if (message.type === "media" || message.type === "image") {
        lastMessageText = "📷 Photo"; // Or "Media"
      } else if (message.type === "file") {
        lastMessageText = "📎 File";
      }

      lastMessageEl.textContent = lastMessageText;

      // Move the chat item to the top of the list
      // .prepend() moves the element instead of copying it
      chatList.prepend(chatItemEl);
    }
  }
  // ================== MESSAGE DISPLAY ==================

  /**
   * Clears the chat body and renders a new list of messages.
   * This is called when a chat is first opened.
   * @param {Array} messages - The array of message objects from the API.
   */
  function loadMessages(messages) {
    chatBody.innerHTML = ""; // Clear any old messages or "loading" text

    if (!messages || messages.length === 0) {
      chatBody.innerHTML =
        '<p class="empty-chat-message">No messages yet. Say hi!</p>';
      return;
    }

    // Loop through and append each message
    messages.forEach((msg) => {
      appendMessage(msg, false); // 'false' = don't scroll after each one
    });

    // Scroll to the bottom *after* all messages are rendered
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /**
   * Creates a message element and appends it to the bottom of the chat.
   * This is used for new incoming/outgoing messages.
   * @param {object} msgObj - The message object to render.
   * @param {boolean} [scroll=true] - Whether to scroll to the bottom after.
   */
  function appendMessage(msgObj, scroll = true) {
    // Prevent rendering duplicates
    if (document.querySelector(`.message[data-message-id='${msgObj.id}']`)) {
      return;
    }
    // Find and remove the "No messages yet" placeholder
    const placeholder = chatBody.querySelector(".empty-chat-message");
    if (placeholder) {
      placeholder.remove();
    }

    const messageElement = createMessageElement(msgObj);
    chatBody.appendChild(messageElement);

    if (scroll) {
      // Use smooth scrolling for a nice effect
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
  }

  /**
   * Creates a message element and prepends it to the *top* of the chat.
   * This is used for loading older messages (infinite scroll).
   * @param {object} msgObj - The message object to render.
   */
  function prependMessage(msgObj) {
    const messageElement = createMessageElement(msgObj);
    chatBody.prepend(messageElement); // Use .prepend() instead of .appendChild()
  }

  /**
   * The main "factory" function. Builds the HTML element for a single message.
   * @param {object} msgObj - The message object.
   * @returns {HTMLElement} The constructed <div> element for the message.
   */
  function createMessageElement(msgObj) {
    // Determine if the message was sent by the current user
    const isSent = msgObj.senderId === window.myUserId;
    const messageClass = isSent ? "sent" : "received";

    // Create the main message container
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${messageClass}`;
    // Use the real ID or a temp ID if it's an optimistic message
    messageDiv.dataset.messageId = msgObj.id;

    // --- 2. Format Time & Status ---
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
      // Note: We don't show sent/read ticks for group messages, only "sending".
    }

    // --- 3. Build Reactions ---
    let reactionsHTML = "";
    // Check both 1-to-1 and group reaction properties
    const reactions =
      msgObj.MessageReactions || msgObj.GroupMessageReactions || [];
    if (reactions.length > 0) {
      // Group reactions by emoji (e.g., { '👍': 3, '❤️': 1 })
      const reactionGroups = reactions.reduce((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] || 0) + 1;
        return acc;
      }, {});

      reactionsHTML = `<div class="message-reactions">`;
      for (const [emoji, count] of Object.entries(reactionGroups)) {
        // Check if the current user is one of the people who reacted with this emoji
        const userHasReacted = reactions.some(
          (r) => r.userId === window.myUserId && r.reaction === emoji
        );
        const reactedClass = userHasReacted ? "user-reacted" : "";
        reactionsHTML += `<div class="reaction-bubble ${reactedClass}" data-reaction="${emoji}">
                            <span>${emoji}</span>
                            <span class="reaction-count">${count}</span>
                          </div>`;
      }
      reactionsHTML += `</div>`;
    }

    // --- 4. Build Options Menu (Edit/Delete) ---
    let optionsHTML = "";
    if (isSent) {
      optionsHTML = `
        <div class="message-options">
          <button class="message-options-btn"><i class='bx bx-chevron-down'></i></button>
          <div class="message-menu">
            ${
              // Only allow editing text messages
              msgObj.type === "text"
                ? '<button class="edit-msg-btn">Edit</button>'
                : ""
            }
            <button class="delete-msg-btn">Delete</button>
          </div>
        </div>`;
    }

    // --- 5. Build Main Content (Text, Image, or File) ---
    let contentHTML = "";
    // If it's a received group message, add the sender's name
    if (!isSent && currentChatType === "group" && msgObj.Sender) {
      contentHTML += `<div class="message-sender-name">${msgObj.Sender.name}</div>`;
    }

    // Helper to build the full URL from a relative path
    const getContentUrl = (contentPath) => {
      if (!contentPath) return "";
      // Handle both full URLs (from JSON) and relative paths
      if (typeof contentPath === "object" && contentPath.url) {
        contentPath = contentPath.url;
      }
      return contentPath.startsWith("http")
        ? contentPath
        : `${BASE_URL}${contentPath}`;
    };

    if (msgObj.type === "image" || msgObj.type === "media") {
      const imageUrl = getContentUrl(msgObj.content);
      contentHTML += `<img src="${imageUrl}" class="chat-attached-image" alt="User uploaded image" />`;
    } else if (msgObj.type === "file") {
      const fileUrl = getContentUrl(msgObj.content);
      // Get the original filename, or just the end of the URL
      const fileName =
        typeof msgObj.content === "object" && msgObj.content.filename
          ? msgObj.content.filename
          : fileUrl.split("/").pop();

      contentHTML += `
        <a href="${fileUrl}" target="_blank" class="file-message-container" download>
          <i class='bx bxs-file-blank file-icon'></i>
          <div class="file-info">
            <span class="file-name">${fileName}</span>
          </div>
        </a>`;
    } else {
      // Default to text
      contentHTML += `<p>${msgObj.message}</p>`;
    }

    // --- 6. Assemble Final HTML ---
    // We create the main content div separately to attach menus *around* it.
    const messageContentDiv = document.createElement("div");
    messageContentDiv.className = "message-content";
    messageContentDiv.innerHTML = `
        ${contentHTML}
        <div class="message-meta">
          <span class="message-time">${messageTime}</span>
          ${statusHTML}
        </div>
    `;
    messageDiv.appendChild(messageContentDiv);

    // Insert reactions, options, and the react button *after* the content
    messageDiv.insertAdjacentHTML("beforeend", reactionsHTML);
    messageDiv.insertAdjacentHTML("beforeend", optionsHTML);
    messageDiv.insertAdjacentHTML(
      "beforeend",
      `<button class="add-reaction-btn" aria-label="Add reaction">
          <i class='bx bx-smile'></i>
       </button>`
    );

    // --- 7. Add Event Listeners for Options ---
    if (isSent) {
      const optionsBtn = messageDiv.querySelector(".message-options-btn");
      const menu = messageDiv.querySelector(".message-menu");
      optionsBtn?.addEventListener("click", (e) => {
        e.stopPropagation(); // Stop the global click handler
        menu.classList.toggle("active");
      });

      const editBtn = messageDiv.querySelector(".edit-msg-btn");
      editBtn?.addEventListener("click", () => {
        editingMessage = messageDiv; // Store the <div>
        chatInput.value = msgObj.message; // Put text in input
        chatInput.focus();
        menu.classList.remove("active");
      });

      const deleteBtn = messageDiv.querySelector(".delete-msg-btn");
      deleteBtn?.addEventListener("click", () => {
        messageToDelete = messageDiv; // Store the <div>
        deleteModal.classList.add("active"); // Show delete confirm modal
        menu.classList.remove("active");
      });
    }

    return messageDiv;
  }

  // ================== MESSAGE SENDING/EDITING ==================

  /**
   * Handles the "Send" button click or "Enter" key press.
   * This function decides whether to send a new text message
   * or update an existing one (if editing).
   */
  async function processMessage() {
    // 1. Get the text from the input
    const messageText = chatInput.value.trim();
    if (sendBtn.disabled) return;
    sendBtn.disabled = true;
    chatInput.disabled = true;

    // 2. Stop if no chat is open or text is empty
    if (!window.currentChatUser) return;
    if (!messageText && !editingMessage) return; // Don't send empty messages

    // --- 3. Handle EDITING an existing message ---
    if (editingMessage) {
      const messageId = parseInt(editingMessage.dataset.messageId);

      // Create the payload for the server
      const payload = {
        messageId: messageId,
        message: messageText,
        chatType: currentChatType,
        // Include receiver/group ID for the server to route the event
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
        ...(currentChatType === "group" && {
          groupId: window.currentChatUser.id,
        }),
      };

      // 4. Emit the "editMessage" event to the server
      socket.emit("editMessage", payload);

      // 5. Optimistic UI Update: Update the message on our *own* screen immediately.
      // We find the <p> tag inside the .message-content div to update.
      const messageContentEl =
        editingMessage.querySelector(".message-content p");
      if (messageContentEl) {
        messageContentEl.textContent = messageText;
      }

      // 6. Reset the editing state
      editingMessage = null;
    } else {
      // --- 3. Handle SENDING a new message ---

      // 4. Create a temporary ID for optimistic UI
      const tempId = `temp-${Date.now()}`;

      // 5. Create the payload for the server
      const messagePayload = {
        message: messageText,
        type: "text", // This is a text message
        tempId: tempId, // Send tempId so the server can return it
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
        ...(currentChatType === "group" && {
          groupId: window.currentChatUser.id,
        }),
      };

      // 6. Create a *full* temporary message object for our UI
      const tempMessageObject = {
        id: tempId,
        senderId: window.myUserId,
        message: messageText,
        type: "text",
        createdAt: new Date().toISOString(),
        status: "sending", // <-- This creates the '🕒' icon
        MessageReactions: [], // Start with empty reactions
        Sender: { id: window.myUserId, name: "You" }, // Minimal sender info
      };

      // 7. Append the "sending" message to the chat
      appendMessage(tempMessageObject);

      // 8. Update the chat list preview
      updateChatListLastMessage(tempMessageObject);

      // 9. Emit "sendMessage" to the server *with a callback*
      socket.emit("sendMessage", messagePayload, (createdMessage) => {
        // This callback runs when the server confirms the message is saved

        // Find the temporary message <div> we just added
        const tempMessageEl = document.querySelector(
          `[data-message-id='${tempId}']`
        );
        if (!tempMessageEl) return; // Message was removed or not found

        if (createdMessage && !createdMessage.error) {
          // --- Success ---
          // 10. Update its ID to the *real* ID from the database
          tempMessageEl.dataset.messageId = createdMessage.id;

          // 11. Update the status icon from '🕒' to '✓'
          const statusEl = tempMessageEl.querySelector(".message-status");
          if (statusEl) {
            statusEl.textContent = "✓";
            statusEl.classList.remove("sending");
            statusEl.classList.add("sent");
          }

          // 12. Update the message object in our local state
          const msgIndex = window.currentChatUser.messages.findIndex(
            (m) => m.id === tempId
          );
          if (msgIndex > -1) {
            window.currentChatUser.messages[msgIndex] = createdMessage;
          }
        } else {
          // --- Failure ---
          tempMessageEl.classList.add("error"); // Style this for a red tint
          const statusEl = tempMessageEl.querySelector(".message-status");
          if (statusEl) {
            statusEl.textContent = "Error";
            statusEl.classList.remove("sending");
          }
          console.error("Server failed to send message:", createdMessage.error);
        }
      });
    }

    // --- Finally, clear the input box and reset typing state ---
    chatInput.value = "";
    isTyping = false;
    clearTimeout(typingTimer);
    sendBtn.disabled = false;
    chatInput.disabled = false;
  }

  /**
   * This is a helper function that will be used by the FILE UPLOAD logic.
   * It takes a new message object (from an axios response) and
   * adds it to the UI.
   */
  const handleSentOrEditedMessage = (msgObj) => {
    // 1. Add the new file/image message to our local state
    if (window.currentChatUser && window.currentChatUser.messages) {
      window.currentChatUser.messages.push(msgObj);
    }

    // 2. Render the new file/image message in the chat
    appendMessage(msgObj);

    // 3. Update the chat list preview
    updateChatListLastMessage(msgObj);
  };

  // ================== FILE UPLOAD ==================
  // ================== FILE UPLOAD ==================

  /**
   * Triggers when the 'attach file' button is clicked.
   * It simply clicks the hidden file input element.
   */
  attachFileBtn.addEventListener("click", () => {
    chatFileInput.click();
  });

  /**
   * Triggers when a file is selected in the hidden input.
   * This function uploads the file to the server.
   */
  chatFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];

    // Stop if no file is selected or no chat is open
    if (!file || !window.currentChatUser) {
      e.target.value = ""; // Reset the input
      return;
    }

    // 1. Create a FormData object to send the file
    const formData = new FormData();
    formData.append("file", file); // 'file' must match the key your backend (multer) expects

    // 2. Determine the correct URL and add the required ID
    let url;
    if (currentChatType === "individual") {
      url = `${BASE_URL}/api/chat/add-file`;
      formData.append("receiverId", window.currentChatUser.id);
    } else {
      url = `${BASE_URL}/api/group/add-file`; // We should name the group route consistently
      formData.append("groupId", window.currentChatUser.id);
    }

    try {
      // 3. Show a "sending" toast
      window.showToast("Uploading file...");

      // 4. Send the file using Axios
      const res = await axios.post(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          // No need to set 'Content-Type': axios does it for FormData
        },
      });

      // 5. Success! The server returns the new, complete message object.
      // We use our existing helper function to display it.
      handleSentOrEditedMessage(res.data);
    } catch (err) {
      // 6. Handle errors
      console.error("Error uploading file:", err.response?.data || err.message);
      window.showToast(
        err.response?.data?.message || "File upload failed.",
        true
      );
    }

    // 7. Reset the input so the user can send the same file again
    e.target.value = "";
  });

  // ================== MESSAGE ACTIONS ==================

  /**
   * Optimistically adds a reaction to the UI and emits the event to the server.
   * @param {string} messageId - The ID of the message to react to.
   * @param {string} reaction - The emoji.
   */
  async function addReaction(messageId, reaction) {
    // --- 1. Optimistic UI Update ---
    const messageEl = document.querySelector(
      `.message[data-message-id='${messageId}']`
    );
    if (!messageEl) return; // Message not found in DOM

    // Find or create the reactions container
    let reactionsContainer = messageEl.querySelector(".message-reactions");
    if (!reactionsContainer) {
      reactionsContainer = document.createElement("div");
      reactionsContainer.className = "message-reactions";
      messageEl
        .querySelector(".message-content")
        .insertAdjacentElement("afterend", reactionsContainer);
    }

    // Find the specific bubble for this emoji
    let bubble = reactionsContainer.querySelector(
      `.reaction-bubble[data-reaction='${reaction}']`
    );

    if (bubble) {
      // Bubble exists: increment count and mark as "reacted"
      const countEl = bubble.querySelector(".reaction-count");
      countEl.textContent = parseInt(countEl.textContent) + 1;
      bubble.classList.add("user-reacted");
    } else {
      // Bubble doesn't exist: create a new one
      bubble = document.createElement("div");
      bubble.className = "reaction-bubble user-reacted"; // Add 'user-reacted' immediately
      bubble.dataset.reaction = reaction;
      bubble.innerHTML = `<span>${reaction}</span><span class="reaction-count">1</span>`;
      reactionsContainer.appendChild(bubble);
    }

    // --- 2. Emit event to server ---
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

  /**
   * Optimistically removes a reaction from the UI and emits the event to the server.
   * @param {string} messageId - The ID of the message.
   * @param {string} reaction - The emoji.
   */
  async function removeReaction(messageId, reaction) {
    // --- 1. Optimistic UI Update ---
    const messageEl = document.querySelector(
      `.message[data-message-id='${messageId}']`
    );
    if (!messageEl) return;

    const bubble = messageEl.querySelector(
      `.reaction-bubble[data-reaction='${reaction}']`
    );
    if (bubble) {
      const countEl = bubble.querySelector(".reaction-count");
      const currentCount = parseInt(countEl.textContent);

      if (currentCount <= 1) {
        // If count is 1, remove the whole bubble
        bubble.remove();
      } else {
        // Otherwise, just decrease the count and remove our "reacted" class
        countEl.textContent = currentCount - 1;
        bubble.classList.remove("user-reacted");
      }
    }

    // --- 2. Emit event to server ---
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

  /**
   * Hides the delete confirmation modal and resets its state.
   */
  const hideDeleteModal = () => {
    deleteModal.classList.remove("active");
    messageToDelete = null; // Clear the stored message
  };

  /**
   * Deletes a message for the user and (optionally) for everyone.
   * This is called by the buttons in the delete modal.
   * @param {boolean} forEveryone - If true, emits "delete for everyone".
   */
  const deleteMessage = async (forEveryone) => {
    if (!messageToDelete) return; // No message selected

    const messageId = parseInt(messageToDelete.dataset.messageId);

    // --- 1. Optimistic UI: Remove the message from our screen ---
    messageToDelete.remove();

    // --- 2. Emit the event to the server ---
    const payload = {
      messageId: messageId,
      forEveryone: forEveryone,
      chatType: currentChatType,
      // Include IDs for server-side routing *if* deleting for everyone
      ...(forEveryone &&
        currentChatType === "group" && { groupId: window.currentChatUser.id }),
      ...(forEveryone &&
        currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
    };

    socket.emit("deleteMessage", payload);

    // --- 3. Clean up ---
    hideDeleteModal();
  };
  // ================== TYPING INDICATORS ==================

  /**
   * Listens for input in the chat box to send "startTyping" and "stopTyping" events.
   */
  chatInput.addEventListener("input", () => {
    // 1. Don't send events if no chat is open
    if (!window.currentChatUser) return;

    // 2. If user isn't marked as typing, mark them and send "startTyping"
    if (!isTyping) {
      isTyping = true;
      const payload = {
        chatType: currentChatType,
        chatId: window.currentChatUser.id,
        // Include receiverId for 1-to-1 so server can route it
        ...(currentChatType === "individual" && {
          receiverId: window.currentChatUser.id,
        }),
      };
      socket.emit("startTyping", payload);
    }

    // 3. Clear the existing "stop" timer
    clearTimeout(typingTimer);

    // 4. Set a new timer. If this timer finishes, the user is "stopped".
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

  // ================== UI HELPERS ==================

  /**
   * Shows or hides the shared emoji picker.
   * It sets the mode to either 'composer' (for the text input)
   * or 'reaction' (for a message).
   * @param {string} mode - 'composer' or 'reaction'.
   * @param {string} [messageId=null] - The message ID if mode is 'reaction'.
   */
  function togglePicker(mode, messageId = null) {
    // If the picker is already open in the same mode, close it
    if (
      sharedEmojiPicker.style.display === "block" &&
      currentPickerMode === mode
    ) {
      sharedEmojiPicker.style.display = "none";
      currentPickerMode = null;
    } else {
      // Otherwise, show it and set its mode
      sharedEmojiPicker.style.display = "block";
      currentPickerMode = mode;

      // Add a class to style it differently for reactions (e.g., position it)
      sharedEmojiPicker.classList.toggle("for-reactions", mode === "reaction");

      if (mode === "reaction") {
        currentMessageIdForReaction = messageId;
      }
    }
  }
  /**
   * Updates a user's online/offline status in all necessary places.
   * This is called by the socket.on() handlers.
   * @param {number} userId - The ID of the user.
   * @param {boolean} isOnline - True if they are online, false if offline.
   */
  function updateUserStatus(userId, isOnline) {
    // --- 1. UPDATE THE MASTER DATA ARRAY (THE FIX) ---
    // Find the user in our main 'chatItems' data array
    const chatItemInData = window.chatItems.find(
      (item) => item.id === userId && item.type === "individual"
    );
    if (chatItemInData) {
      // Update its 'isOnline' property. This is the new, live data.
      chatItemInData.isOnline = isOnline;
    }

    // --- 2. UPDATE THE CHAT LIST DOM (Your existing code) ---
    // Find the user in the main chat list (the <li> element)
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

    // --- 3. UPDATE THE CURRENTLY OPEN CHAT (Your existing code) ---
    // Update the chat header if we are currently talking to them
    if (
      currentChatType === "individual" &&
      window.currentChatUser &&
      window.currentChatUser.id === userId
    ) {
      // Store the latest status on the *current* object
      window.currentChatUser.isOnline = isOnline;

      // Only update the header text if no one is currently typing
      if (usersTyping.size === 0) {
        updateHeaderStatus(isOnline);
      }
    }
  }

  /**
   * Called by socket events to decide *what* the header status should be.
   */
  function updateTypingIndicator() {
    // Get an array of names from the 'usersTyping' map
    const typers = Array.from(usersTyping.keys());

    if (typers.length > 0) {
      // --- CHANGE ---
      // If anyone is typing, set the status to "typing..."
      updateHeaderStatus("typing...");
      // --- END CHANGE ---
    } else {
      // --- CHANGE ---
      // If no one is typing, restore the user's *actual* online/offline status.
      // We check the 'isOnline' property we stored on the currentChatUser object.
      updateHeaderStatus(window.currentChatUser?.isOnline);
      // --- END CHANGE ---
    }
  }

  /**
   * Displays a short-lived notification message on the screen.
   * (We wrote this in the first step, but include it here for completeness)
   */
  let toastTimer;
  window.showToast = (msg, isError = false) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = "show"; // Reset classes
    if (isError) {
      toast.classList.add("error");
    }
    toastTimer = setTimeout(() => {
      toast.classList.remove("show", "error");
    }, 3000);
  };
  /**
   * Updates the text and class of the main chat header status.
   * @param {string|boolean} status - Can be "typing...", true (online), or false (offline).
   */
  function updateHeaderStatus(status) {
    const headerStatusEl = document.getElementById("chat-header-status");
    const typingEl = document.getElementById("chat-header-typing"); // The old element
    if (!headerStatusEl || !typingEl) return;

    // 1. We'll permanently hide the old "typing..." element
    typingEl.style.display = "none";

    // 2. Update the main status element based on the 'status' parameter
    if (status === "typing...") {
      headerStatusEl.textContent = "typing...";
      headerStatusEl.className = "typing"; // You can style this in CSS
    } else if (status === true) {
      headerStatusEl.textContent = "online";
      headerStatusEl.className = "online";
    } else {
      // Handles false, null, and undefined
      headerStatusEl.textContent = "offline";
      headerStatusEl.className = "offline";
    }
  }
  // ================== EVENT LISTENERS ==================

  // --- 1. Send button click ---
  sendBtn.addEventListener("click", processMessage);

  // --- 2. Enter key press ---
  chatInput.addEventListener("keypress", (e) => {
    // Check if the key pressed was "Enter" and the input isn't disabled
    if (e.key === "Enter" && !chatInput.disabled) {
      e.preventDefault(); // Stop it from adding a new line
      processMessage();
    }
  });

  // --- 3. File attachment (We wrote this, but include it here) ---
  attachFileBtn.addEventListener("click", () => {
    chatFileInput.click();
  });
  // The 'change' listener for chatFileInput was already written
  // in the FILE UPLOAD section.

  // --- 4. Emoji picker ---
  emojiBtn.addEventListener("click", () => {
    // Open the picker in 'composer' mode
    togglePicker("composer");
  });

  sharedEmojiPicker.addEventListener("emoji-click", async (event) => {
    const emoji = event.detail.unicode;

    if (currentPickerMode === "composer") {
      // Add emoji to the text input
      chatInput.value += emoji;
    } else if (currentPickerMode === "reaction") {
      // Add a reaction to the stored message ID
      if (currentMessageIdForReaction) {
        await addReaction(currentMessageIdForReaction, emoji);
      }
    }

    // Hide the picker and reset state after selection
    sharedEmojiPicker.style.display = "none";
    currentPickerMode = null;
    currentMessageIdForReaction = null;
  });

  // --- 5 & 6. Message options and Reaction clicks (Event Delegation) ---
  // We use one listener on the chatBody to handle clicks on all messages
  chatBody.addEventListener("click", async (e) => {
    // --- Handle "Add Reaction" button ---
    const addReactionBtn = e.target.closest(".add-reaction-btn");
    if (addReactionBtn) {
      const messageEl = addReactionBtn.closest(".message");
      // Open the picker in "reaction mode" for this specific message
      togglePicker("reaction", messageEl.dataset.messageId);
      return;
    }

    // --- Handle clicking an *existing* reaction bubble ---
    const bubble = e.target.closest(".reaction-bubble");
    if (bubble) {
      const messageEl = bubble.closest(".message");
      const messageId = messageEl.dataset.messageId;
      const reaction = bubble.dataset.reaction;

      // If we've already clicked it, remove our reaction
      if (bubble.classList.contains("user-reacted")) {
        await removeReaction(messageId, reaction);
      } else {
        // Otherwise, add our reaction
        await addReaction(messageId, reaction);
      }
      return;
    }

    // Note: The 'edit' and 'delete' button listeners
    // are added inside the `createMessageElement` function.
  });

  // --- 7. Infinite scroll ---
  chatViewContainer.addEventListener("scroll", async () => {
    // Check if we are scrolled to the top and have a chat open
    if (
      chatViewContainer.scrollTop === 0 &&
      window.currentChatUser &&
      !window.currentChatUser.loadedAll // And we haven't loaded all messages yet
    ) {
      // Get the ID of the *first* message currently in the DOM
      const firstMessageEl = chatBody.querySelector(".message");
      if (!firstMessageEl) return;

      const firstMessageId = firstMessageEl.dataset.messageId;

      // Store the current scroll height
      const oldScrollHeight = chatBody.scrollHeight;

      try {
        // Fetch messages *before* this one
        const url = `${BASE_URL}/api/${
          currentChatType === "individual" ? "chat/fetch" : "group/messages"
        }/${window.currentChatUser.id}?before=${firstMessageId}&limit=20`; // Load 20 older messages

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const olderMessages = res.data || [];

        if (olderMessages.length === 0) {
          window.currentChatUser.loadedAll = true; // No more messages to load
          return;
        }

        // Add older messages to our local state
        window.currentChatUser.messages.unshift(...olderMessages);

        // Prepend them to the chat body
        olderMessages.reverse().forEach((msg) => prependMessage(msg));

        // Maintain the scroll position
        chatBody.scrollTop = chatBody.scrollHeight - oldScrollHeight;
      } catch (err) {
        console.error("Error loading older messages:", err);
      }
    }
  });

  // --- 8. Global click handlers (for closing popups) ---
  document.addEventListener("click", (e) => {
    // --- Logic for closing the Emoji Picker ---
    const isEmojiButton = e.target.closest("#emoji-btn");
    const isReactionButton = e.target.closest(".add-reaction-btn");
    const isInsidePicker = e.target.closest("#shared-emoji-picker");

    if (!isEmojiButton && !isReactionButton && !isInsidePicker) {
      sharedEmojiPicker.style.display = "none";
      currentPickerMode = null;
    }

    // --- Logic for closing Message Option Menus ---
    const openMenus = document.querySelectorAll(".message-menu.active");
    openMenus.forEach((menu) => {
      // If the click was NOT inside the parent of this specific open menu, close it.
      if (!menu.parentElement.contains(e.target)) {
        menu.classList.remove("active");
      }
    });
  });

  // --- 9. Delete Modal Button Listeners ---
  cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  deleteForMeBtn.addEventListener("click", () => deleteMessage(false));
  deleteForEveryoneBtn.addEventListener("click", () => deleteMessage(true));

  // ================== SOCKET EVENT HANDLERS ==================
  function setupWebSocket() {
    // Initialize socket with auth
    socket = io({
      auth: {
        token: token, // Send JWT token for authentication
      },
    });
    // Socket connection error handling
    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err.message);

      // Handle authentication errors
      if (err.message === "Authentication error") {
        alert("Your session has expired. Please log in again.");
        sessionStorage.removeItem("token");
        window.location.href = "/login";
      }

      // Handle other connection errors
      if (err.message.includes("Unauthorized")) {
        alert("Authentication failed. Please log in again.");
        sessionStorage.removeItem("token");
        window.location.href = "/login";
      }
    });

    socket.on("connect", () => {
      console.log(`Connected to websocket server with ID:${socket.id}`);
    });
    /**
     * 1. Handles incoming new messages from other users.
     */
    socket.on("newMessage", (newMessage) => {
      // 1. Don't re-render our own messages (we handle them optimistically)
      if (newMessage.senderId === window.myUserId) {
        return;
      }

      // 2. Check if the message is for the chat we are currently looking at
      const isForCurrentChat =
        (currentChatType === "group" &&
          window.currentChatUser &&
          newMessage.groupId === window.currentChatUser.id) ||
        (currentChatType === "individual" &&
          window.currentChatUser &&
          newMessage.senderId === window.currentChatUser.id);

      if (isForCurrentChat) {
        // 3. If chat is open, just append the message
        appendMessage(newMessage);

        // 4. Tell the server we have read this message immediately
        socket.emit("markChatAsRead", {
          chatId: window.currentChatUser.id,
          chatType: currentChatType,
        });
      }

      // 5. ALWAYS update the last message preview in the chat list.
      updateChatListLastMessage(newMessage);
    });

    /**
     * 2. Handles a message being edited by another user.
     */
    socket.on("messageEdited", (updatedMessage) => {
      // Find the message element on the screen
      const messageEl = document.querySelector(
        `.message[data-message-id='${updatedMessage.id}']`
      );

      if (messageEl) {
        // Find the specific <p> tag and update its text
        const messageContentEl = messageEl.querySelector(".message-content p");
        if (messageContentEl) {
          messageContentEl.textContent = updatedMessage.message;
        }

        // (Optional but good) Update the message in our local data array
        if (window.currentChatUser && window.currentChatUser.messages) {
          const msgIndex = window.currentChatUser.messages.findIndex(
            (m) => m.id === updatedMessage.id
          );
          if (msgIndex > -1) {
            window.currentChatUser.messages[msgIndex].message =
              updatedMessage.message;
          }
        }
      }
    });

    /**
     * 3. Handles a reaction being added by another user.
     */
    socket.on("reactionAdded", ({ messageId, reaction, userId }) => {
      // Don't update for our own reaction (optimistic UI)
      if (userId === window.myUserId) return;

      const messageEl = document.querySelector(
        `.message[data-message-id='${messageId}']`
      );
      if (!messageEl) return;

      // Find or create the reactions container
      let reactionsContainer = messageEl.querySelector(".message-reactions");
      if (!reactionsContainer) {
        reactionsContainer = document.createElement("div");
        reactionsContainer.className = "message-reactions";
        messageEl
          .querySelector(".message-content")
          .insertAdjacentElement("afterend", reactionsContainer);
      }

      // Find or create the specific reaction bubble
      let bubble = reactionsContainer.querySelector(
        `.reaction-bubble[data-reaction='${reaction}']`
      );
      if (bubble) {
        // Increment count
        const countEl = bubble.querySelector(".reaction-count");
        countEl.textContent = parseInt(countEl.textContent) + 1;
      } else {
        // Create new bubble
        bubble = document.createElement("div");
        bubble.className = "reaction-bubble";
        bubble.dataset.reaction = reaction;
        bubble.innerHTML = `<span>${reaction}</span><span class="reaction-count">1</span>`;
        reactionsContainer.appendChild(bubble);
      }
    });

    /**
     * 4. Handles a reaction being removed by another user.
     */
    socket.on("reactionRemoved", ({ messageId, reaction, userId }) => {
      // Don't update for our own reaction (optimistic UI)
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
          bubble.remove(); // Remove the bubble if count is zero
        }
      }
    });

    /**
     * 5. Handles a message being deleted "for everyone".
     */
    socket.on("messageDeleted", ({ messageId }) => {
      const messageEl = document.querySelector(
        `.message[data-message-id='${messageId}']`
      );
      if (messageEl) {
        messageEl.remove();
      }
    });

    /**
     * 6. Handles when another user starts typing.
     */
    socket.on("userIsTyping", ({ chatId, userName }) => {
      // Only show if it's for the current chat
      if (window.currentChatUser && window.currentChatUser.id === chatId) {
        // Add user and set a timer to auto-remove them (as a fallback)
        if (usersTyping.has(userName)) {
          clearTimeout(usersTyping.get(userName)); // Clear old timer
        }
        const timer = setTimeout(() => {
          usersTyping.delete(userName);
          updateTypingIndicator();
        }, 3000); // Auto-remove after 3 seconds

        usersTyping.set(userName, timer);
        updateTypingIndicator(); // Update the UI
      }
    });

    /**
     * 7. Handles when another user stops typing.
     */
    socket.on("userStoppedTyping", ({ chatId, userName }) => {
      // Only clear if it's for the current chat
      if (window.currentChatUser && window.currentChatUser.id === chatId) {
        if (usersTyping.has(userName)) {
          clearTimeout(usersTyping.get(userName)); // Clear the auto-remove timer
          usersTyping.delete(userName);
          updateTypingIndicator(); // Update the UI
        }
      }
    });

    /**
     * 8. Handles a user coming online or going offline.
     */
    socket.on("userOnline", ({ userId }) => {
      console.log(
        `🔴 SOCKET: "userOnline" event received for user: ${userId}.`
      );
      updateUserStatus(userId, true);
    });
    socket.on("userOffline", ({ userId }) => {
      updateUserStatus(userId, false);
    });

    /**
     * 9. Handles when our sent message is read by the recipient (1-to-1).
     */
    socket.on("messagesRead", ({ chatId }) => {
      // Check if the user is currently looking at the chat that just got read
      if (
        currentChatType === "individual" &&
        window.currentChatUser &&
        window.currentChatUser.id === chatId
      ) {
        // Find all *our* sent messages that are not yet marked as read
        const unreadMessages = document.querySelectorAll(
          ".message.sent:not(.read)"
        );

        unreadMessages.forEach((msgDiv) => {
          msgDiv.classList.add("read");
          const statusEl = msgDiv.querySelector(".message-status");
          if (statusEl) {
            statusEl.textContent = "✓✓"; // Double tick
            statusEl.classList.remove("sent", "sending");
            statusEl.classList.add("read");
          }
        });
      }
    });

    /**
     * 10. Handles a friend request being accepted or a new friend being added.
     * This keeps the chat list in sync with contacts.js.
     */
    socket.on("friendRequestAccepted", ({ message, newFriend }) => {
      window.showToast(message);
      console.log("BUG_HUNT: Received newFriend object:", newFriend);
      // Add to our local lists and re-render
      window.allUsers.push(newFriend);
      window.chatItems.push(newFriend);
      window.renderChatList();
    });
    // (Assuming 'newFriendAdded' is a similar event)
    socket.on("newFriendAdded", ({ message, newFriend }) => {
      window.showToast(message);
      window.allUsers.push(newFriend);
      window.chatItems.push(newFriend);
      window.renderChatList();
    });

    /**
     * 11. Handles being added to or removed from a group.
     */
    socket.on("addedToGroup", (newGroup) => {
      window.showToast(`You've been added to the group: ${newGroup.name}`);
      allGroups.push(newGroup);
      window.chatItems.push({ ...newGroup, type: "group" }); // Already has type
      window.renderChatList();
    });

    socket.on("removedFromGroup", ({ groupId, groupName }) => {
      window.showToast(`You have been removed from ${groupName}.`);

      // Remove from local lists
      window.chatItems = window.chatItems.filter(
        (item) => !(item.type === "group" && item.id === groupId)
      );
      allGroups = allGroups.filter((group) => group.id !== groupId);
      window.renderChatList(); // Re-render the list

      // CRITICAL: If we were *viewing* that group, close it
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

    /**
     * 12. Handles updates to the unread message count for any chat.
     */
    socket.on("unreadCountUpdate", ({ chatId, newCount }) => {
      console.log(
        `🔔 CLIENT: Real-time update! Chat ${chatId} now has ${newCount} unread.`
      );
      const chatItemEl = document.querySelector(`.chat[data-id='${chatId}']`);
      if (!chatItemEl) return;

      let badge = chatItemEl.querySelector(".notification-badge");
      if (!badge && newCount > 0) {
        // Create badge if it doesn't exist and is needed
        badge = document.createElement("span");
        badge.className = "notification-badge";
        chatItemEl.appendChild(badge); // Append to the <li>
      }

      if (newCount > 0) {
        badge.textContent = newCount;
        badge.style.display = "flex";
      } else if (badge) {
        // Hide badge if count is 0
        badge.style.display = "none";
      }
    });
    socket.on("newFriendRequest", (senderData) => {
      window.showToast(`New friend request from ${senderData.name}`);
      // Find your contacts tab button by its ID
      const contactsBtn = document.getElementById("contacts-tab-btn");
      if (contactsBtn) {
        // This class should make a red dot appear
        contactsBtn.classList.add("has-notification");
      }
    });
    socket.on("auth_error", (errorMsg) => {
      console.error("Websocket Auth Error:", errorMsg);
    });
    socket.on("disconnect", () => {
      console.log("Disconnected from websocket server.");
    });
  }
  // ================== RUN INITIALIZATION ==================
  /**
   * This is the main startup sequence for the app.
   * We change the order to fix the "offline" bug.
   */
  async function main() {
    // 1. Find out who we are.
    await fetchCurrentUserId();

    if (window.myUserId) {
      // 2. Fetch all friends & groups FIRST.
      // This populates window.chatItems with the "stale" data.
      await fetchAndRenderFriends();

      // 3. NOW connect to the real-time server.
      setupWebSocket();

      // 4. When the socket connects (inside setupWebSocket),
      // it will emit "goOnline". The server will send back
      // the "onlineUserList", and our updateUserStatus()
      // function will now correctly find and update the
      // users in the window.chatItems array.
    }
  }

  // Run the app
  main();
}); // This is the end of your file
