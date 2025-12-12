/**
 * ===================================================================
 * sendMessages.js
 *
 * This file controls all logic for the main chat interface.
 * It is built as a non-real-time, HTTP-only (Axios) application.
 *
 * Responsibilities:
 * 1. Load the initial list of friends (from /api/contacts/friends).
 * 2. Handle selecting a friend's chat.
 * 3. Fetch message history for the selected chat.
 * 4. Send, edit, delete, and react to messages via Axios.
 * 5. Handle all UI interactions (emoji picker, modals, etc.).
 * ===================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // --- 1. AUTHENTICATION GUARD ---
  // Stop script execution if no login token is found.
  const token = sessionStorage.getItem("token");
  if (!token) {
    alert("You must be logged in");
    window.location.href = "/login";
    return;
  }

  // --- 2. DOM ELEMENT SELECTIONS ---
  // Get all necessary elements from the page.
  const chatList = document.querySelector(".chat-list-items");
  const chatBody = document.getElementById("chat-body");
  const chatInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const chatHeaderName = document.getElementById("chat-header-name");
  const chatHeaderImg = document.getElementById("chat-header-img");
  const chatHeaderStatus = document.getElementById("chat-header-status");
  const chatHeaderTyping = document.getElementById("chat-header-typing");
  const attachFileBtn = document.getElementById("attach-file-btn");
  const chatFileInput = document.getElementById("chat-file-input");
  const chatViewContainer = document.getElementById("chat-view");
  const placeholder = document.querySelector(".main-placeholder");
  const container = document.querySelector(".container");
  const toast = document.getElementById("toast-notification");

  // Modals
  const deleteModal = document.getElementById("delete-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const deleteForMeBtn = document.getElementById("delete-for-me-btn");
  const deleteForEveryoneBtn = document.getElementById(
    "delete-for-everyone-btn"
  );
  
  // Emoji Picker
  const emojiBtn = document.getElementById("emoji-btn");
  const sharedEmojiPicker = document.getElementById("shared-emoji-picker");

  // --- 3. GLOBAL STATE VARIABLES ---
  window.myUserId = null;
  window.currentChatUser = null; // Stores the user object of the person we are chatting with
  let currentChatType = 'individual';
  let editingMessage = null; // Stores the HTML element of the message being edited
  let messageToDelete = null; // Stores the HTML element of the message to be deleted
  window.chatItems = []; // The master list of chat contacts
  let allUsers = []; // The raw list of friends
  let allGroups =[];
  let currentPickerMode = null; // 'composer' or 'reaction'
  let currentMessageIdForReaction = null;
  let toastTimer; // Timer for the toast notification

  // --- 4. GLOBAL CLICK HANDLER (FOR CLOSING POPUPS) ---
  /**
   * Listens for clicks anywhere on the document.
   * Used to close any open popups (like menus or pickers)
   * when the user clicks "outside" of them.
   */
  document.addEventListener("click", (e) => {
    // Logic for closing the Emoji Picker
    const isEmojiButton = e.target.closest("#emoji-btn");
    const isReactionButton = e.target.closest(".add-reaction-btn");
    const isInsidePicker = e.target.closest("#shared-emoji-picker");

    if (!isEmojiButton && !isReactionButton && !isInsidePicker) {
      if (sharedEmojiPicker.style.display === "block") {
        sharedEmojiPicker.style.display = "none";
        currentPickerMode = null;
      }
    }

    // Logic for closing Message Option Menus
    const openMenus = document.querySelectorAll(".message-menu.active");
    openMenus.forEach((menu) => {
      if (!menu.parentElement.contains(e.target)) {
        menu.classList.remove("active");
      }
    });
  });

  // --- 5. CORE FUNCTIONS (INITIALIZATION & CHAT LOADING) ---

  /**
   * Fetches the logged-in user's ID. This is a critical
   * gatekeeper step.
   */
  async function fetchCurrentUserId() {
    try {
      const response = await axios.get(`${BASE_URL}/api/user/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.myUserId = Number(response.data.userData.id);
    } catch (err) {
      console.error(
        "Error fetching user info:",
        err.response?.data || err.message
      );
      // This is a critical failure, likely an expired token.
      // The axios interceptor in config.js should catch this 401 and redirect.
      // We add a fallback just in case.
      alert("Session expired. Please log in again.");
      sessionStorage.removeItem("token");
      window.location.href = "/login";
    }
  }

  /**
   * Fetches the user's friends list one time to populate the chat sidebar.
   */
  const initializeChatData = async () => {
    try {
      // Fetch friends and their unread counts
      const [usersResponse, groupsResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/contacts/friends`,{
            headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${BASE_URL}/api/group/fetch`,{
            headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      allUsers = usersResponse.data.friends || [];
      allGroups = groupsResponse.data ||[];
      // Map all users as 'individual' type
      chatItems = allUsers.map((u) => ({ ...u, type: "individual" }));
      
      renderChatList();
    } catch (err) {
      console.error("Error initializing chat data:", err);
    }
  };

  /**
   * Renders the list of friends in the chat sidebar (midsection).
   */
  window.renderChatList = () => {
    chatList.innerHTML = "";
    chatItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "chat";
      li.dataset.id = item.id;
      li.dataset.name = item.name;
      li.dataset.img =
        item.img ||
        `https://placehold.co/50x50/695cfe/ffffff?text=${item.name[0].toUpperCase()}`;
      li.dataset.type = "individual"; // Hardcoded for 1-to-1 chat

      // Get unread count that was fetched during initialization
      const unreadCount = item.unreadCount || 0;

      li.innerHTML = `
        <img src="${li.dataset.img}" alt="${item.name}" class="chat-img" />
        <div class="chat-info">
          <h3 class="chat-name">${item.name}</h3>
          <p class="chat-message">Click to view chat</p>
        </div>
        ${
          unreadCount > 0
            ? `<span class="notification-badge">${unreadCount}</span>`
            : ""
        }
      `;

      li.addEventListener("click", () => {
        selectChat(item.id);
      });
      chatList.appendChild(li);
    });
  };

  /**
   * Called when a user is clicked in the chat list.
   * Finds the user data and calls openChat.
   * @param {number} userId - The ID of the friend to chat with.
   */
  const selectChat = async (userId) => {
    // Find the user from our 'chatItems' list, which has the 'type'
    window.currentChatUser = chatItems.find(
      (item) => item.type === "individual" && item.id === userId
    );
    if (!window.currentChatUser) return;
    
    // Hide group-related UI (if it's loaded by another script)
    window.hideAdminFeatures(); 
    
    await openChat(window.currentChatUser);
  };

  /**
   * Opens a chat window, clears old messages, and fetches new ones.
   * @param {object} chatEntity - The user object (currentChatUser).
   */
  const openChat = async (chatEntity) => {
    // 1. Set State & UI
    placeholder.classList.remove("active");
    chatViewContainer.classList.add("active");

    // Handle mobile view
    if (window.innerWidth <= 768) {
      container.classList.add("mobile-chat-active");
    }

    // 2. Populate Header & Clear Chat
    chatEntity.loadedAll = false; // For infinite scroll
    chatHeaderName.textContent = chatEntity.name;
    chatHeaderImg.src =
      chatEntity.img ||
      `https://placehold.co/50x50/695cfe/ffffff?text=${chatEntity.name[0].toUpperCase()}`;
    chatHeaderStatus.textContent = "Offline"; // Default (no real-time presence)
    chatHeaderTyping.style.display = "none";
    chatBody.innerHTML = "";

    // 3. Fetch Message History
    await fetchAndRenderMessages();

    // 4. Mark As Read (via HTTP POST)
    try {
      await axios.post(
        `${BASE_URL}/api/chat/mark-read`,
        { chatId: chatEntity.id }, // Send receiverId as chatId
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Optimistic UI update for the badge
      const chatItemEl = document.querySelector(
        `.chat[data-id='${chatEntity.id}']`
      );
      if (chatItemEl) {
        const badge = chatItemEl.querySelector(".notification-badge");
        if (badge) badge.style.display = "none";
      }
    } catch (err) {
      console.warn("Could not mark chat as read", err.message);
    }
  };

  /**
   * Fetches the complete message history for the current chat.
   * Also used by the "Refresh" button.
   */
  const fetchAndRenderMessages = async () => {
    if (!window.currentChatUser) return;

    try {
      const url = `${BASE_URL}/api/chat/fetch/${window.currentChatUser.id}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      window.currentChatUser.messages = res.data || [];
      loadMessages(window.currentChatUser.messages);
    } catch (err) {
      console.error("Error fetching messages:", err);
      showToast("Could not load messages.", true);
    }
  };

  /**
   * Clears the chat body and renders a new list of messages.
   * @param {Array} messages - The array of message objects.
   */
  const loadMessages = (messages) => {
    chatBody.innerHTML = "";
    messages.forEach((msg) => appendMessage(msg, false));
    chatBody.scrollTop = chatBody.scrollHeight; // Scroll to bottom
  };

  /**
   * Creates the HTML for a single message and appends it to the chat body.
   * @param {object} msgObj - The message object.
   * @param {boolean} [scroll=true] - Whether to scroll to the bottom.
   */
  const appendMessage = (msgObj, scroll = true) => {
    const messageElement = createMessageElement(msgObj);
    chatBody.appendChild(messageElement);
    if (scroll) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  };

  // --- 6. MESSAGE RENDERING ---

  /**
   * Creates the HTML element for a single message bubble.
   * @param {object} msgObj - The message object.
   * @returns {HTMLElement} The constructed <div> element for the message.
   */
  const createMessageElement = (msgObj) => {
    const isSent = msgObj.senderId === window.myUserId;
    const messageClass = isSent ? "sent" : "received";

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${messageClass}`;
    messageDiv.dataset.messageId = msgObj.id;

    // Format the time
    const messageTime = new Date(msgObj.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Determine the status tick
    let statusHTML = "";
    if (isSent) {
      if (msgObj.status === "read") {
        statusHTML = '<span class="message-status read">✓✓</span>';
      } else if (msgObj.status === "sent") {
        statusHTML = '<span class="message-status sent">✓</span>';
      } else if (msgObj.status === "sending") {
        statusHTML = '<span class="message-status sending">🕒</span>';
      }
    }

    // Build Reactions
    let reactionsHTML = "";
    const reactions = msgObj.MessageReactions || [];
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
        reactionsHTML += `<div class="reaction-bubble ${reactedClass}" data-reaction="${emoji}">
                            <span>${emoji}</span>
                            <span class="reaction-count">${count}</span>
                          </div>`;
      }
      reactionsHTML += `</div>`;
    }

    // Build Options (Edit/Delete)
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

    // Build Content (Text, Image, File)
    let contentHTML = "";
    const getContentUrl = (contentPath) => {
      if (!contentPath) return "";
      return contentPath.startsWith("http")
        ? contentPath
        : `${BASE_URL}${contentPath}`;
    };
    if (msgObj.type === "image") {
      const imageUrl = getContentUrl(msgObj.content);
      contentHTML = `<img src="${imageUrl}" class="chat-attached-image" alt="User uploaded image" />`;
    } else if (msgObj.type === "file") {
      const fileUrl = getContentUrl(msgObj.content);
      const fileName = fileUrl.split("/").pop();
      contentHTML = `
          <a href="${fileUrl}" target="_blank" class="file-message-container" download>
            <i class='bx bxs-file-blank file-icon'></i>
            <div class="file-info">
              <span class="file-name">${fileName}</span>
            </div>
          </a>`;
    } else {
      contentHTML = `<p>${msgObj.message}</p>`; // Wrap text in <p> for styling
    }

    // Assemble the final message HTML
    messageDiv.innerHTML = `
      <div class="message-content">
        ${contentHTML}
        <div class="message-meta">
          <span class="message-time">${messageTime}</span>
          ${statusHTML}
        </div>
      </div>
      ${reactionsHTML}
      ${optionsHTML}
      <button class="add-reaction-btn" aria-label="Add reaction">
          <i class='bx bx-smile'></i>
      </button>
    `;

    // Add event listeners for options (if they exist)
    if (isSent) {
      const optionsBtn = messageDiv.querySelector(".message-options-btn");
      const menu = messageDiv.querySelector(".message-menu");
      optionsBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent global click handler from firing
        menu.classList.toggle("active");
      });

      const editBtn = messageDiv.querySelector(".edit-msg-btn");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          editingMessage = messageDiv;
          chatInput.value = msgObj.message;
          chatInput.focus();
          menu.classList.remove("active");
        });
      }

      const deleteBtn = messageDiv.querySelector(".delete-msg-btn");
      deleteBtn.addEventListener("click", () => {
        messageToDelete = messageDiv;
        deleteModal.classList.add("active");
        menu.classList.remove("active");
      });
    }

    return messageDiv;
  };

  // --- 7. API HANDLER FUNCTIONS (HTTP) ---

  /**
   * Handles sending a new text message or updating an edited one.
   * All logic is HTTP (Axios) based.
   */
  const processMessage = async () => {
    if (!window.currentChatUser) {
      showToast("No chat selected.", true);
      return;
    }
    const text = chatInput.value.trim();
    if (!text) return;

    if (editingMessage) {
      // --- Logic for EDITING (HTTP) ---
      const messageId = parseInt(editingMessage.dataset.messageId);
      try {
        await axios.put(
          `${BASE_URL}/api/chat/edit/${messageId}`,
          { message: text },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Optimistic UI update
        const messageContentEl =
          editingMessage.querySelector(".message-content p");
        if (messageContentEl) messageContentEl.textContent = text;
        
      } catch (err) {
        console.error("Error editing message:", err);
        showToast("Could not edit message.", true);
      } finally {
        editingMessage = null; // Reset editing state
      }

    } else {
      // --- Logic for SENDING (HTTP) ---
      const tempId = `temp-${Date.now()}`;
      const messagePayload = {
        message: text,
        type: "text",
        receiverId: window.currentChatUser.id,
      };

      const tempMessageObject = {
        id: tempId,
        senderId: window.myUserId,
        message: text,
        type: "text",
        createdAt: new Date().toISOString(),
        status: "sending", // 🕒
        MessageReactions: [],
      };

      appendMessage(tempMessageObject);

      try {
        // Send to server
        const response = await axios.post(
          `${BASE_URL}/api/chat/add`, // Use the 'add' route
          messagePayload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // On success, update the temporary message
        const createdMessage = response.data;
        const tempMessageEl = document.querySelector(
          `[data-message-id='${tempId}']`
        );
        if (tempMessageEl) {
          tempMessageEl.dataset.messageId = createdMessage.id;
          const statusEl = tempMessageEl.querySelector(".message-status");
          if (statusEl) {
            statusEl.textContent = "✓"; // Sent
            statusEl.classList.remove("sending");
            statusEl.classList.add("sent");
          }
        }
      } catch (err) {
        console.error("Error sending message:", err);
        const tempMessageEl = document.querySelector(
          `[data-message-id='${tempId}']`
        );
        if (tempMessageEl) tempMessageEl.classList.add("error");
        showToast("Message failed to send.", true);
      }
    }
    chatInput.value = "";
  };

  /**
   * Handles adding a reaction via an HTTP request.
   * @param {string} messageId - The ID of the message to react to.
   * @param {string} reaction - The emoji.
   */
  async function addReaction(messageId, reaction) {
    // Optimistic UI update is handled in the click listener
    try {
      await axios.post(
        `${BASE_URL}/api/chat/react/${messageId}`,
        { reaction },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Error adding reaction:", err);
      showToast("Failed to add reaction.", true);
      // (Future: Add logic to revert the optimistic UI on failure)
    }
  }

  /**
   * Handles removing a reaction via an HTTP request.
   * @param {string} messageId - The ID of the message.
   * @param {string} reaction - The emoji.
   */
  async function removeReaction(messageId, reaction) {
    // Optimistic UI update is handled in the click listener
    try {
      await axios.delete(`${BASE_URL}/api/chat/react/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { reaction }, // DELETE request body must be in 'data'
      });
    } catch (err) {
      console.error("Error removing reaction:", err);
      showToast("Failed to remove reaction.", true);
      // (Future: Add logic to revert the optimistic UI on failure)
    }
  }

  /**
   * Handles uploading a file via HTTP.
   */
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.currentChatUser) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiverId", window.currentChatUser.id);

    const url = `${BASE_URL}/api/chat/add-file`; // 1-to-1 only

    try {
      showToast("Uploading file...");
      const res = await axios.post(url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      appendMessage(res.data); // Append the new file message
    } catch (err) {
      console.error("Error uploading file:", err.response?.data || err.message);
      showToast("File upload failed.");
    }
    e.target.value = ""; // Reset input
  };

  /**
   * Handles deleting a message via HTTP.
   * @param {boolean} forEveryone - Whether to delete for all users.
   */
  const deleteMessage = async (forEveryone) => {
    if (!messageToDelete) return;
    const messageId = parseInt(messageToDelete.dataset.messageId);

    // Optimistic UI: Remove from screen immediately
    messageToDelete.remove();
    hideDeleteModal();

    try {
      await axios.delete(`${BASE_URL}/api/chat/delete/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { forEveryone: forEveryone }, // Send 'forEveryone' as a query param
      });
    } catch (err) {
      console.error("Error deleting message:", err);
      showToast("Could not delete message.", true);
      // If the delete fails, the message is gone from UI but will
      // reappear on next refresh. This is acceptable for this version.
    }
  };

  /** Hides the delete confirmation modal. */
  const hideDeleteModal = () => {
    deleteModal.classList.remove("active");
    messageToDelete = null;
  };

  // --- 8. EMOJI PICKER LOGIC ---
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
      // Position the picker
      sharedEmojiPicker.classList.toggle("for-reactions", mode === "reaction");
      if (mode === "reaction") {
        currentMessageIdForReaction = messageId;
      }
    }
  }

  // --- 9. EVENT LISTENERS ---
  // Connects the DOM elements to their handler functions.

  // Sending Messages
  sendBtn.addEventListener("click", processMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processMessage();
  });

  // Sending Files
  attachFileBtn.addEventListener("click", () => chatFileInput.click());
  chatFileInput.addEventListener("change", handleFileChange);

  // Manual Refresh (if you add the button)
  
  // Delete Modal
  cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  deleteForMeBtn.addEventListener("click", () => deleteMessage(false));
  deleteForEveryoneBtn.addEventListener("click", () => deleteMessage(true));

  // Emoji Button
  emojiBtn.addEventListener("click", () => {
    togglePicker("composer");
  });

  // Emoji Picker Selection
  sharedEmojiPicker.addEventListener("emoji-click", async (event) => {
    const emoji = event.detail.unicode;
    if (currentPickerMode === "composer") {
      chatInput.value += emoji;
    } else if (currentPickerMode === "reaction") {
      if (currentMessageIdForReaction) {
        await addReaction(currentMessageIdForReaction, emoji);
      }
    }
    // Hide picker after selection
    sharedEmojiPicker.style.display = "none";
    currentPickerMode = null;
  });

  // Reaction Click Handler (Event Delegation)
  chatBody.addEventListener("click", async (e) => {
    // Case 1: User clicks the "Add Reaction" button (smiley face)
    const addReactionBtn = e.target.closest(".add-reaction-btn");
    if (addReactionBtn) {
      const messageEl = addReactionBtn.closest(".message");
      togglePicker("reaction", messageEl.dataset.messageId);
      return;
    }

    // Case 2: User clicks an existing reaction bubble
    const bubble = e.target.closest(".reaction-bubble");
    if (bubble) {
      const messageEl = bubble.closest(".message");
      const messageId = messageEl.dataset.messageId;
      const reaction = bubble.dataset.reaction;

      if (bubble.classList.contains("user-reacted")) {
        await removeReaction(messageId, reaction);
      } else {
        await addReaction(messageId, reaction);
      }
      return;
    }
  });

  // --- 10. HELPER FUNCTIONS ---

  /** A placeholder function for group-related scripts */
  window.hideAdminFeatures = () => {
    const groupBtn = document.getElementById("manage-group-btn");
    if (groupBtn) groupBtn.style.display = "none";
  };
  
  /** Toast Notification */
  window.showToast = function (msg, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = "show";
    if (isError) {
      toast.classList.add("error");
    }
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  };

  // ================== INITIALIZE ==================
  await fetchCurrentUserId();
  await initializeChatData();
});