/* ==========================
   CONTACTS HUB V3 - REWRITTEN
========================== */

document.addEventListener("DOMContentLoaded", () => {
  const contactsContent = document.getElementById("contacts-content");
  const toast = document.getElementById("toast-notification");
  let toastTimer;
  const userCache = {};
  const BASE_URL = ""; // Set your backend base URL if needed

  // --- UI HELPER FUNCTIONS ---

  /**
   * Displays a short-lived notification message on the screen.
   * @param {string} message The message to display.
   * @param {boolean} isError If true, displays with an error style.
   */
  const showToast = (message, isError = false) => {
    if (!toast) return;
    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "show"; // Reset classes

    if (isError) {
      toast.classList.add("error");
    }

    toastTimer = setTimeout(() => {
      toast.classList.remove("show", "error");
    }, 3000);
  };

  /**
   * Creates the HTML for a single contact list item.
   * @param {object} user - The user data object.
   * @param {string} category - The category this user belongs to.
   * @returns {HTMLLIElement} The created list item element.
   */
  const createContactListItem = (user, category) => {
    const li = document.createElement("li");
    li.className = "contact-list-item";
    li.dataset.userId = user.id;

    let actionButtons = "";
    const requestId = user.Contact?.id; // user.Contact.id = relationship/request record ID

    switch (category) {
      case "receivedRequests":
        actionButtons = `
          <button class="action-btn accept-btn" data-request-id="${requestId}" title="Accept"><i class="fas fa-check"></i></button>
          <button class="action-btn decline-btn" data-request-id="${requestId}" title="Decline"><i class="fas fa-times"></i></button>
        `;
        break;

      case "sentRequests":
        // *** BUG FIX ***: Now correctly includes the data-request-id for consistency.
        actionButtons = `
          <button class="action-btn cancel-request-btn" data-request-id="${requestId}" title="Cancel Request"><i class="fas fa-undo"></i></button>
        `;
        break;

      case "friends":
        actionButtons = `
          <button class="action-btn remove-btn" title="Unfriend"><i class="fas fa-user-minus"></i></button>
        `;
        break;

      case "blockedUsers":
        actionButtons = `
          <button class="unblock-btn" title="Unblock">Unblock</button>
        `;
        break;

      case "availableUsers":
        actionButtons = `
          <button class="action-btn add-btn" title="Add Friend"><i class="fas fa-user-plus"></i></button>
        `;
        break;
    }

    li.innerHTML = `
      <img src="${user.img || `https://placehold.co/45x45/695cfe/ffffff?text=${user.name[0].toUpperCase()}`}" 
           alt="${user.name}'s profile picture" 
           class="chat-img" />
      <div class="contact-item-info">
        <h4>${user.name}</h4>
      </div>
      <div class="contact-item-actions">${actionButtons}</div>
    `;

    return li;
  };

  /**
   * Renders a list of users into a specific category in the DOM.
   * @param {string} listId - The ID of the <ul> element.
   * @param {object[]} users - An array of user objects.
   * @param {string} category - The name of the category.
   */
  const renderCategory = (listId, users, category) => {
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    listEl.innerHTML = ""; // Clear previous content

    if (!users || users.length === 0) {
      listEl.innerHTML = '<li><p class="empty-list-message">Nothing to show here.</p></li>';
    } else {
      users.forEach((user) => {
        userCache[user.id] = user; // Update cache
        listEl.appendChild(createContactListItem(user, category));
      });
    }

    // Update the count badge
    const categoryEl = listEl.closest(".contact-category");
    if (!categoryEl) return;

    const badge = categoryEl.querySelector(".contact-badge");
    if (badge) {
      badge.textContent = users.length;
      badge.style.display = users.length > 0 ? "inline-flex" : "none";
    }
  };

  // --- API & DATA HANDLING ---

  /**
   * A generic helper to perform API calls.
   * @param {string} method - The HTTP method (e.g., 'get', 'post').
   * @param {string} endpoint - The API endpoint URL.
   * @param {object} [data={}] - The request payload for POST requests.
   * @returns {Promise<object>} - The response data from the server.
   */
  const apiService = async (method, endpoint, data = {}) => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      showToast("Authentication error. Please log in again.", true);
      throw new Error("No token found");
    }

    const headers = { Authorization: `Bearer ${token}` };
    return axios[method](
      `${BASE_URL}${endpoint}`,
      method === "get" ? { headers } : data,
      { headers }
    );
  };

  /**
   * Fetches all contact data from the server and renders all categories.
   */
  const loadContactsData = async () => {
    const categoriesToFetch = [
      {
        endpoint: "/api/contacts/friends",
        listId: "friends-list",
        category: "friends",
        dataKey: "friends",
      },
      {
        endpoint: "/api/contacts/received/requests",
        listId: "received-requests-list",
        category: "receivedRequests",
        dataKey: "receivedRequests",
      },
      {
        endpoint: "/api/contacts/sent/requests",
        listId: "sent-requests-list",
        category: "sentRequests",
        dataKey: "sentRequests",
      },
      {
        endpoint: "/api/contacts/friends/blocked",
        listId: "blocked-users-list",
        category: "blockedUsers",
        dataKey: "blockedUsers",
      },
      {
        endpoint: "/api/contacts/friends/suggestions",
        listId: "suggestions-list",
        category: "availableUsers",
        dataKey: "availableUsers",
      },
    ];

    const fetchPromises = categoriesToFetch.map((cat) =>
      apiService("get", cat.endpoint)
        .then((response) => {
          const users = response.data[cat.dataKey] || [];
          renderCategory(cat.listId, users, cat.category);
        })
        .catch((error) => {
          console.error(`Error loading ${cat.category}:`, error);
          const listEl = document.getElementById(cat.listId);
          if (listEl)
            listEl.innerHTML =
              '<li><p class="empty-list-message">Could not load data.</p></li>';
        })
    );

    // Fetch all categories in parallel for better performance
    await Promise.all(fetchPromises);
  };

  // --- EVENT LISTENERS ---

  /**
   * Handles clicks on the main contacts container using event delegation.
   */
  contactsContent.addEventListener("click", async (e) => {
    const button = e.target.closest(".action-btn, .unblock-btn");
    if (!button) return;

    e.stopPropagation(); // Prevent accordion toggle on button click

    const li = button.closest(".contact-list-item");
    if (!li) return;

    const userId = li.dataset.userId;
    const requestId = button.dataset.requestId; // Used for request-specific actions
    const user = userCache[userId] || { name: `User ${userId}` };

    try {
      let responseMessage = "";

      if (button.classList.contains("accept-btn")) {
        await apiService("post", `/api/contacts/accept/${requestId}`, {
          action: "accept",
        });
        responseMessage = `You and ${user.name} are now friends.`;
      } else if (button.classList.contains("decline-btn")) {
        await apiService("post", `/api/contacts/decline/${requestId}`, {
          action: "decline",
        });
        responseMessage = `Request from ${user.name} declined.`;
      } else if (button.classList.contains("add-btn")) {
        await apiService("post", `/api/contacts/send-request/${userId}`);
        responseMessage = `Friend request sent to ${user.name}.`;
      } else if (button.classList.contains("remove-btn")) {
        await apiService("post", `/api/contacts/unfriend/${userId}`);
        responseMessage = `${user.name} has been unfriended.`;
      } else if (button.classList.contains("cancel-request-btn")) {
        // *** BUG FIX ***: API call now targets the specific request ID.
        // NOTE: This requires a backend route change from /:userId to /:requestId.
        await apiService("post", `/api/contacts/cancel-request/${requestId}`);
        responseMessage = `Request to ${user.name} cancelled.`;
      } else if (button.classList.contains("unblock-btn")) {
        await apiService("post", `/api/contacts/unblock/${userId}`);
        responseMessage = `${user.name} has been unblocked.`;
      }

      if (responseMessage) showToast(responseMessage);
      await loadContactsData(); // Refresh all lists

    } catch (error) {
      console.error("Contact action failed:", error);
      const serverMessage = error.response?.data?.message;
      showToast(serverMessage || "Action failed. Please try again.", true);
    }
  });

  /**
   * Handles the accordion toggle functionality for categories.
   */
  document.querySelectorAll(".contact-category").forEach((categoryEl) => {
    categoryEl.addEventListener("click", (e) => {
      // Prevent clicks on buttons from toggling the accordion
      if (e.target.closest(".action-btn") || e.target.closest(".unblock-btn")) {
        return;
      }

      const allCategories = document.querySelectorAll(".contact-category");
      const isActive = categoryEl.classList.contains("active");

      // Close all other categories
      allCategories.forEach((el) => el.classList.remove("active"));

      // If not active, open it
      if (!isActive) {
        categoryEl.classList.add("active");
      }
    });
  });

  // --- INITIALIZATION ---
  window.contactsManager = {
    load: loadContactsData,
  };

  loadContactsData();
});
