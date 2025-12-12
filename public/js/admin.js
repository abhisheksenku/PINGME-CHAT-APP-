document.addEventListener("DOMContentLoaded", () => {
  // ================== ADMIN DOM ELEMENTS (FINAL, CLEANED VERSION) ==================
  const manageGroupBtn = document.getElementById("manage-group-btn");
  const chatView = document.querySelector(".chat-view");

  // --- Panel Elements ---
  const groupManagementPanel = document.getElementById(
    "group-management-panel"
  );
  const backFromGroupManagementBtn = document.getElementById(
    "back-from-group-management"
  );
  const editPanelBtn = document.getElementById("edit-panel-btn");

  // --- View Mode Elements ---
  const viewGroupName = document.getElementById("view-group-name");
  const viewGroupDescription = document.getElementById(
    "view-group-description"
  );

  // --- Edit Mode Elements ---
  const editGroupForm = document.getElementById("edit-group-form");
  const editGroupNameInput = document.getElementById("edit-group-name");
  const editGroupDescriptionInput = document.getElementById(
    "edit-group-description"
  );
  const editGroupImgInput = document.getElementById("edit-group-img");
  const cancelEditGroupBtn = document.getElementById("cancel-edit-group-btn");

  // --- Member List ---
  const groupMembersList = document.getElementById("group-members-list");

  // --- Confirmation Modal ---
  const confirmActionModal = document.getElementById("confirm-action-modal");
  const confirmModalTitle = document.getElementById("confirm-modal-title");
  const confirmModalText = document.getElementById("confirm-modal-text");
  const confirmActionBtn = document.getElementById("confirm-action-btn");
  const cancelActionBtn = document.getElementById("cancel-action-btn");
  const addMembersModal = document.getElementById("add-members-modal");
  const closeAddMembersModalBtn = document.getElementById(
    "close-add-members-modal"
  );
  const addMemberSearchInput = document.getElementById("add-member-search");
  const addMembersContactList = document.getElementById(
    "add-members-contact-list"
  );
  const confirmAddMembersBtn = document.getElementById(
    "confirm-add-members-btn"
  );
  const leaveGroupBtn = document.getElementById("leave-group-btn");
  const deleteGroupBtn = document.getElementById("delete-group-btn");
  const placeholder = document.querySelector(".main-placeholder");
  // --- Global State ---
  const token = sessionStorage.getItem("token");
  let currentUserIsAdmin = false;
  let currentGroupMembers = [];
  let fullAddableFriendsList = [];
  let selectedMembersToAdd = [];

  // ================== CORE FUNCTIONS ==================

  window.initializeAdminFeatures = async (groupId) => {
    manageGroupBtn.style.display = "none";
    currentUserIsAdmin = false;

    try {
      const members = await fetchGroupMembers(groupId);
      currentGroupMembers = members;

      const currentUserMember = members.find(
        (member) => member.userId === window.myUserId
      );
      if (currentUserMember && currentUserMember.role === "admin") {
        currentUserIsAdmin = true;
        manageGroupBtn.style.display = "flex";
      }
    } catch (error) {
      console.error("Could not initialize admin features:", error);
    }
  };

  window.hideAdminFeatures = () => {
    manageGroupBtn.style.display = "none";
  };
  // Replace your existing renderGroupMembers function with this corrected one
  const renderGroupMembers = () => {
    groupMembersList.innerHTML = "";
    currentGroupMembers.forEach((member) => {
      const memberItem = document.createElement("li");
      memberItem.className = "member-item";

      // This version has the duplicated <div> removed.
      memberItem.innerHTML = `
            <img src="${
              member.User.img ||
              `https://placehold.co/50x50/695cfe/ffffff?text=${member.User.name[0].toUpperCase()}`
            }" alt="${member.User.name}">
            <div class="member-info">
                <span class="member-name">${member.User.name} ${
        member.userId === window.myUserId ? "(You)" : ""
      }</span>
                <span class="member-role">${member.role}</span>
            </div>
            <div class="member-actions">
                <select class="role-select" data-member-id="${member.userId}">
                    <option value="member" ${
                      member.role === "member" ? "selected" : ""
                    }>Member</option>
                    <option value="admin" ${
                      member.role === "admin" ? "selected" : ""
                    }>Admin</option>
                </select>
                <button class="remove-member-btn" data-member-id="${
                  member.userId
                }">Remove</button>
            </div>
        `;
      groupMembersList.appendChild(memberItem);
    });
  };
  const renderAddableFriendsList = (friends) => {
    addMembersContactList.innerHTML = "";
    if (friends.length === 0) {
      addMembersContactList.innerHTML =
        '<li class="no-results">No friends to add.</li>';
      return;
    }

    friends.forEach((friend) => {
      const li = document.createElement("li");
      li.className = "contact-item";
      li.dataset.userId = friend.id;
      li.innerHTML = `
            <img src="${
              friend.img ||
              `https://placehold.co/40x40/695cfe/ffffff?text=${friend.name[0].toUpperCase()}`
            }" alt="${friend.name}">
            <span class="contact-name">${friend.name}</span>
            <input type="checkbox" id="add-user-${
              friend.id
            }" class="add-member-checkbox" data-user-id="${friend.id}">
<label for="add-user-${friend.id}" class="custom-checkbox-label">
    <span class="custom-checkbox"></span>
</label>
`;
      addMembersContactList.appendChild(li);
    });
  };
  const openAddMembersModal = async () => {
    const groupId = window.currentChatUser.id;
    selectedMembersToAdd = []; // Reset selections
    addMemberSearchInput.value = ""; // Reset search

    try {
      const res = await axios.get(
        `${BASE_URL}/api/group/${groupId}/addable-friends`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fullAddableFriendsList = res.data;
      renderAddableFriendsList(fullAddableFriendsList);
      addMembersModal.classList.add("active");
    } catch (error) {
      console.error("Failed to fetch addable friends:", error);
      window.showToast("Could not load friends list.");
    }
  };
  const populateGroupManagementPanel = () => {
    if (!window.currentChatUser) return;

    // Populate both view and edit fields
    viewGroupName.textContent = window.currentChatUser.name;
    viewGroupDescription.textContent =
      window.currentChatUser.description || "No description provided.";
    editGroupNameInput.value = window.currentChatUser.name;
    editGroupDescriptionInput.value = window.currentChatUser.description || "";
    editGroupImgInput.value = window.currentChatUser.img || "";

    // Show the master "Edit" button only if the user is an admin
    editPanelBtn.style.display = currentUserIsAdmin ? "inline-flex" : "none";

    // Always start in "View Mode" by default
    groupManagementPanel.classList.remove("edit-mode-active");
    renderGroupMembers();
  };

  // ================== API HANDLER FUNCTIONS ==================

  async function fetchGroupMembers(groupId) {
    try {
      const res = await axios.get(`${BASE_URL}/api/group/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (error) {
      console.error("Failed to fetch group members:", error);
      window.showToast("Could not load group members.");
      return [];
    }
  }

  async function removeMember(groupId, memberId) {
    try {
      await axios.delete(
        `${BASE_URL}/api/group/${groupId}/members/${memberId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      window.showToast("Member removed successfully.");
      currentGroupMembers = currentGroupMembers.filter(
        (m) => m.userId !== memberId
      );
      renderGroupMembers();
    } catch (error) {
      console.error("Failed to remove member:", error);
      window.showToast(
        error.response?.data?.message || "Failed to remove member."
      );
    }
  }

  async function updateRole(groupId, memberId, newRole) {
    try {
      await axios.put(
        `${BASE_URL}/api/group/${groupId}/members/${memberId}`,
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      window.showToast("Member role updated.");
      const memberToUpdate = currentGroupMembers.find(
        (m) => m.userId === memberId
      );
      if (memberToUpdate) memberToUpdate.role = newRole;
      renderGroupMembers();
    } catch (error) {
      console.error("Failed to update role:", error);
      window.showToast(
        error.response?.data?.message || "Failed to update role."
      );
    }
  }

  async function updateGroupDetails(groupId, newName, newDescription, newImg) {
    try {
      const payload = {
        name: newName,
        description: newDescription,
        img: newImg,
      };
      await axios.put(`${BASE_URL}/api/group/${groupId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.showToast("Group details updated.");

      if (window.currentChatUser) {
        window.currentChatUser.name = newName;
        window.currentChatUser.description = newDescription;
        window.currentChatUser.img = newImg;
      }
      document.getElementById("chat-header-name").textContent = newName;
      document.getElementById("chat-header-img").src = newImg;

      populateGroupManagementPanel(); // Repopulate to show new data and exit edit mode
    } catch (error) {
      console.error("Failed to update group:", error);
      window.showToast(
        error.response?.data?.message || "Failed to update group."
      );
    }
  }
  async function leaveGroup(groupId) {
    try {
      await axios.delete(`${BASE_URL}/api/group/${groupId}/leave`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      window.showToast("You have left the group.");

      // UI Update: Close the panel and refresh the page to update the chat list.
      groupManagementPanel.classList.remove("active");
      chatView.classList.remove("active");
      placeholder.classList.add("active");
      window.location.reload(); // Simplest way to ensure a clean state
    } catch (error) {
      console.error("Failed to leave group:", error);
      window.showToast(
        error.response?.data?.message || "Failed to leave group."
      );
    }
  }
  async function deleteGroup(groupId) {
    try {
      await axios.delete(`${BASE_URL}/api/group/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      window.showToast("Group deleted successfully.");

      // UI Update: Close the panel and refresh the page.
      groupManagementPanel.classList.remove("active");
      chatView.classList.remove("active");
      placeholder.classList.add("active");
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete group:", error);
      window.showToast(
        error.response?.data?.message || "Failed to delete group."
      );
    }
  }
  function showConfirmationModal(title, text) {
    return new Promise((resolve) => {
      confirmModalTitle.textContent = title;
      confirmModalText.textContent = text;
      confirmActionModal.classList.add("active");

      confirmActionBtn.addEventListener(
        "click",
        () => {
          confirmActionModal.classList.remove("active");
          resolve(true);
        },
        { once: true }
      );

      cancelActionBtn.addEventListener(
        "click",
        () => {
          confirmActionModal.classList.remove("active");
          resolve(false);
        },
        { once: true }
      );
    });
  }

  // ================== EVENT LISTENERS (FINAL, CLEANED VERSION) ==================

  manageGroupBtn.addEventListener("click", () => {
    chatView.classList.remove("active");
    groupManagementPanel.classList.add("active");
    populateGroupManagementPanel();
  });

  backFromGroupManagementBtn.addEventListener("click", () => {
    groupManagementPanel.classList.remove("active");
    chatView.classList.add("active");
  });

  editPanelBtn.addEventListener("click", () => {
    groupManagementPanel.classList.add("edit-mode-active");
  });

  cancelEditGroupBtn.addEventListener("click", () => {
    groupManagementPanel.classList.remove("edit-mode-active");
    populateGroupManagementPanel();
  });

  groupMembersList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("remove-member-btn")) {
      const memberId = parseInt(e.target.dataset.memberId);
      const confirmed = await showConfirmationModal(
        "Remove Member?",
        "Are you sure you want to remove this member?"
      );
      if (confirmed) {
        removeMember(window.currentChatUser.id, memberId);
      }
    }
  });

  groupMembersList.addEventListener("change", (e) => {
    if (e.target.classList.contains("role-select")) {
      const memberId = parseInt(e.target.dataset.memberId);
      const newRole = e.target.value;
      updateRole(window.currentChatUser.id, memberId, newRole);
    }
  });

  editGroupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newName = editGroupNameInput.value.trim();
    const newDescription = editGroupDescriptionInput.value.trim();
    const newImg = editGroupImgInput.value.trim();
    updateGroupDetails(
      window.currentChatUser.id,
      newName,
      newDescription,
      newImg
    );
  });
  document
    .getElementById("open-add-members-modal-btn")
    .addEventListener("click", openAddMembersModal);
  closeAddMembersModalBtn.addEventListener("click", () => {
    addMembersModal.classList.remove("active");
  });
  addMemberSearchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredFriends = fullAddableFriendsList.filter((friend) =>
      friend.name.toLowerCase().includes(searchTerm)
    );
    renderAddableFriendsList(filteredFriends);
  });
  addMembersContactList.addEventListener("change", (e) => {
    if (e.target.classList.contains("add-member-checkbox")) {
      const userId = parseInt(e.target.dataset.userId);
      if (e.target.checked) {
        // Add to selection if not already there
        if (!selectedMembersToAdd.includes(userId)) {
          selectedMembersToAdd.push(userId);
        }
      } else {
        // Remove from selection
        selectedMembersToAdd = selectedMembersToAdd.filter(
          (id) => id !== userId
        );
      }
    }
  });
  confirmAddMembersBtn.addEventListener("click", async () => {
    if (selectedMembersToAdd.length === 0) {
      window.showToast("Please select at least one member to add.");
      return;
    }

    const groupId = window.currentChatUser.id;
    try {
      await axios.post(
        `${BASE_URL}/api/group/${groupId}/members`,
        { userIds: selectedMembersToAdd },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      window.showToast("Members added successfully!");
      addMembersModal.classList.remove("active");

      // IMPORTANT: Refresh the main member list
      const updatedMembers = await fetchGroupMembers(groupId);
      currentGroupMembers = updatedMembers;
      renderGroupMembers(); // This redraws the list in the main panel
    } catch (error) {
      console.error("Failed to add members:", error);
      window.showToast("Failed to add members.");
    }
  });
  leaveGroupBtn.addEventListener("click", async () => {
    // First, ask the user for confirmation
    const confirmed = await showConfirmationModal(
      "Leave Group?",
      "You will no longer be able to see messages or participate in this group. Are you sure?"
    );

    // Only proceed if the user clicked "CONFIRM"
    if (confirmed) {
      leaveGroup(window.currentChatUser.id);
    }
  });

  deleteGroupBtn.addEventListener("click", async () => {
    // First, ask for confirmation for this destructive action
    const confirmed = await showConfirmationModal(
      "Delete Group?",
      "This is permanent and cannot be undone. All messages and members will be removed forever. Are you sure?"
    );

    // Only proceed if the user confirmed
    if (confirmed) {
      deleteGroup(window.currentChatUser.id);
    }
  });
});
