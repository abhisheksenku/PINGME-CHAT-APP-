/**
 * ===================================================================
 * groupCreation.js
 *
 * Handles all logic for the "New Group" panel.
 * - Fetches the user's friends list.
 * - Renders friends into a selectable list with custom checkboxes.
 * - Handles search/filtering of the friends list.
 * - Listens for the "Create Group" button click.
 * - Sends the new group data to the API.
 * - Updates the global state (window.chatItems, window.allGroups) and refreshes the chat list.
 * ===================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. AUTHENTICATION GUARD ---
  const token = sessionStorage.getItem("token");
  if (!token) {
    // This script runs on the chat page, so the main sendMessages.js
    // will have already handled the redirect. We can just stop.
    console.error("GroupCreation Error: No token found.");
    return;
  }

  // --- 2. DOM ELEMENT SELECTIONS ---
  const newGroupBtn = document.getElementById("menu-new-group");
  const newGroupPanel = document.getElementById("new-group-content");
  const backBtnGroup = document.getElementById("back-button-group");
  const mobileNewGroupBtn = document.getElementById("mobile-new-group");
  const newChatMenu = document.getElementById("new-chat-menu");
  const mobileMenu = document.getElementById("mobile-menu");

  const createGroupBtn = document.querySelector(
    "#new-group-content .create-group-btn"
  );
  const groupNameInput = document.getElementById("group-name");
  const groupSearchInput = document.getElementById("group-search");
  const groupContactList = document.querySelector(
    "#new-group-content .chat-list-items"
  );

  // --- 3. STATE ---
  let users = []; // Local cache of the user's friends

  // --- 4. HELPER FUNCTIONS ---

  /**
   * Fetches the user's friends list from the server to populate the "add members" list.
   */
  const fetchUsersFromServer = async () => {
    try {
      // This assumes the /api/contacts/friends route is available
      const res = await axios.get(`${BASE_URL}/api/contacts/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      users = res.data.friends || []; // Store in our local cache
      renderGroupContacts(users); // Initial render
    } catch (err) {
      console.error(
        "Error fetching users for group:",
        err.response?.data || err.message
      );
      if (window.showToast) {
        window.showToast("Could not load friends list.", true);
      }
    }
  };

  /**
   * Renders the list of friends into the "Add Members" modal UI.
   * This is the CORRECTED version that builds the custom checkbox HTML.
   * @param {Array} list - The list of user (friend) objects to render.
   */
  const renderGroupContacts = (list) => {
    groupContactList.innerHTML = ""; // Clear old list

    if (!list || list.length === 0) {
      groupContactList.innerHTML =
        "<li class='empty-list-message'>No friends to add.</li>";
      return;
    }

    list.forEach((user) => {
      const li = document.createElement("li");
      // Use the same class name as the admin modal for consistent styling
      li.className = "user-list-item";

      // 1. Create the (hidden) checkbox
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      // This class is used by your createGroupBtn listener
      checkbox.className = "contact-checkbox";
      checkbox.id = `create-group-user-${user.id}`; // Unique ID for the label
      checkbox.dataset.id = user.id; // This is what you use to get the ID

      // 2. Create the (visible) label
      const label = document.createElement("label");
      label.htmlFor = `create-group-user-${user.id}`; // Links label to checkbox

      // 3. Create the image
      const img = document.createElement("img");
      img.src =
        user.img ||
        `https://placehold.co/40x40/695cfe/ffffff?text=${user.name[0].toUpperCase()}`;
      img.alt = user.name;
      img.className = "chat-img"; // Match your other list images

      // 4. Create the name
      const nameSpan = document.createElement("span");
      nameSpan.textContent = user.name;

      // 5. Create the custom checkbox span (this is what the CSS styles)
      const customCheckbox = document.createElement("span");
      customCheckbox.className = "custom-checkbox";

      // 6. Assemble the label (Image, Name, Custom Checkbox)
      label.appendChild(img);
      label.appendChild(nameSpan);
      label.appendChild(customCheckbox);

      // 7. Assemble the final list item
      li.appendChild(checkbox);
      li.appendChild(label);

      groupContactList.appendChild(li);
    });
  };

  /**
   * Handles the 'input' event on the group search bar.
   * Filters the locally cached 'users' list and re-renders.
   */
  function handleSearchInput() {
    const term = groupSearchInput.value.toLowerCase();
    const filtered = users.filter((u) => u.name.toLowerCase().includes(term));
    renderGroupContacts(filtered);
  }

  /**
   * Handles the "Create Group" button click.
   * Gathers data, sends it to the API, and updates the global UI.
   */
  async function handleCreateGroupClick() {
    const groupName = groupNameInput.value.trim();

    // Validation
    if (!groupName) {
      window.showToast("Please enter a group name", true);
      return;
    }

    // Find all checked boxes and get their 'data-id'
    const selectedMemberIds = [];
    document
      .querySelectorAll("#new-group-content .contact-checkbox:checked")
      .forEach((cb) => {
        selectedMemberIds.push(cb.dataset.id);
      });

    if (selectedMemberIds.length === 0) {
      window.showToast("Please select at least one member", true);
      return;
    }

    try {
      // Send the data to the server
      const res = await axios.post(
        `${BASE_URL}/api/group/create`,
        {
          name: groupName,
          members: selectedMemberIds,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newGroup = res.data;
      window.showToast("Group created successfully!");

      // --- 1. Add the new group to the global allGroups cache ---
      window.allGroups.push(newGroup);

      // --- 2. Add the new group to the global master chatItems list ---
      // This ensures it appears in the sidebar.
      window.chatItems.push({
        ...newGroup,
        type: "group",
        messages: [],
        unreadCount: 0,
      });

      // --- 3. Call the global render function (from sendMessages.js) ---
      if (typeof window.renderChatList === "function") {
        window.renderChatList();
      }

      // --- 4. Reset the form and close the panel ---
      groupNameInput.value = "";
      document
        .querySelectorAll("#new-group-content .contact-checkbox:checked")
        .forEach((cb) => (cb.checked = false));

      if (typeof window.showMainTabs === "function") {
        window.showMainTabs();
      }
    } catch (err) {
      console.error("Error creating group:", err.response?.data || err.message);
      window.showToast(
        err.response?.data?.message || "Failed to create group",
        true
      );
    }
  }

  // --- 5. ATTACH EVENT LISTENERS ---

  // Search
  groupSearchInput.addEventListener("input", handleSearchInput);

  // Panel Navigation
  newGroupBtn.addEventListener("click", () => {
    newChatMenu.classList.remove("active");
    if (typeof window.showPanel === "function") window.showPanel(newGroupPanel);
  });

  mobileNewGroupBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    if (typeof window.showPanel === "function") window.showPanel(newGroupPanel);
  });

  backBtnGroup.addEventListener("click", () => {
    if (typeof window.showMainTabs === "function") window.showMainTabs();
  });

  // Main "Create Group" button
  createGroupBtn.addEventListener("click", handleCreateGroupClick);

  // --- 6. INITIALIZATION ---
  // Fetch the list of friends as soon as this script loads.
  fetchUsersFromServer();
});
