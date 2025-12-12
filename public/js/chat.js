document.addEventListener("DOMContentLoaded", () => {
  // --- 1. AUTHENTICATION GUARD ---
  // Check for a token immediately. If it doesn't exist,
  // stop executing this script and redirect to the login page.
  const token = sessionStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return; // Stop the script
  }

  // --- 2. DOM ELEMENT SELECTIONS ---
  // Group all element selections at the top for easy reference.
  const body = document.body;
  const container = document.querySelector(".container");

  // Main Layout & Panels
  const tabs = document.querySelectorAll(".menu-links li");
  const contentPanels = document.querySelectorAll(".content-panel");
  const midsectionHeader = document.getElementById("main-midsection-header");

  // Main Section Panels
  const mainPlaceholder = document.querySelector(".main-placeholder");
  const chatView = document.querySelector(".chat-view");
  const statusView = document.getElementById("status-view");

  // Midsection Sub-Panels (Profile, Settings, etc.)
  const profileSettingsPanel = document.getElementById(
    "profile-settings-content"
  );
  const generalSettingsPanel = document.getElementById(
    "general-settings-content"
  );
  const newGroupPanel = document.getElementById("new-group-content");

  // Dark Mode
  const toggleModeButton = document.querySelector(".toggle-mode button");
  const modeIcon = document.getElementById("modeIcon");
  const mobileDarkmodeBtn = document.getElementById("mobile-darkmode-btn");

  // Profile & Settings
  const profileButton = document.getElementById("profile-button");
  const profileModal = document.getElementById("profile-modal");
  const closeProfileModal = document.getElementById("close-profile-modal");
  const editProfileButton = document.querySelector(".edit-btn");
  const backButtonProfile = document.getElementById("back-button-profile");
  const settingsButton = document.getElementById("settings-button");
  const backButtonSettings = document.getElementById("back-button-settings");
  const mobileProfileBtn = document.getElementById("mobile-profile-btn");
  const mobileSettingsBtn = document.getElementById("mobile-settings-btn");

  // Status View
  const statusContentPanel = document.getElementById("status-content");
  const statusUserName = document.getElementById("status-user-name");
  const statusUserImg = document.getElementById("status-user-img");
  const statusTime = document.getElementById("status-time");
  const statusImage = document.getElementById("status-image");
  const closeStatusView = document.getElementById("close-status-view");

  // Mobile Menu
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileBackBtn = document.querySelector(".mobile-back-btn");

  // New Chat/Group
  const newChatBtn = document.getElementById("new-chat-btn");
  const newChatMenu = document.getElementById("new-chat-menu");

  // --- 3. GLOBAL STATE ---
  // Keep track of the last active tab (Chats, Status, Contacts)
  let lastActiveTabId = "chats-tab";

  // --- 4. HELPER FUNCTIONS ---
  // Reusable functions for controlling UI visibility.

  /** Hides all panels in the main chat section (placeholder, chat, status). */
  function hideAllMainPanels() {
    if (mainPlaceholder) mainPlaceholder.classList.remove("active");
    if (chatView) chatView.classList.remove("active");
    if (statusView) statusView.classList.remove("active");
  }

  /**
   * Shows a specific sub-panel in the midsection (like Profile or Settings).
   * @param {HTMLElement} panelToShow - The panel element to make active.
   */
  function showPanel(panelToShow) {
    midsectionHeader.style.display = "none";
    contentPanels.forEach((p) => p.classList.remove("active"));
    tabs.forEach((t) => t.classList.remove("active"));
    panelToShow.classList.add("active");
  }

  /** Restores the main midsection view to the last active tab (Chats, Status, Contacts). */
  function showMainTabs() {
    // Hide all sub-panels
    contentPanels.forEach((p) => p.classList.remove("active"));
    // Show the main header (logo, search)
    midsectionHeader.style.display = "block";
    
    // Deactivate all tabs
    tabs.forEach((t) => t.classList.remove("active"));
    
    // Activate the last saved tab
    const activeTab = document.getElementById(lastActiveTabId);
    if (activeTab) activeTab.classList.add("active");

    // Show the content panel corresponding to the active tab
    const contentId = lastActiveTabId.replace("-tab", "-content");
    const contentPanel = document.getElementById(contentId);
    if (contentPanel) contentPanel.classList.add("active");
  }

  // --- 5. EVENT HANDLERS ---
  // These functions define *what* happens when a user interacts.

  /** Handles clicking on a main sidebar tab (Chats, Status, Contacts). */
  function handleTabClick(event) {
    const tab = event.currentTarget;
    lastActiveTabId = tab.id; // Save this as the new "last active" tab
    showMainTabs(); // Restore the main view based on this tab

    // On mobile, close the chat window when switching tabs
    if (window.innerWidth <= 768) {
      container.classList.remove("mobile-chat-active");
    }

    // If the contacts tab was clicked, trigger its data loader
    // (This assumes contacts.js has exposed a 'contactsManager' object)
    if (tab.id === "contacts-tab") {
      if (
        window.contactsManager &&
        typeof window.contactsManager.load === "function"
      ) {
        window.contactsManager.load();
      }
    }
  }

  /** Toggles the UI between light and dark mode. */
  function toggleDarkMode() {
    body.classList.toggle("dark");
    const isDark = body.classList.contains("dark");

    // Update main sidebar icon
    modeIcon.className = isDark ? "bx bx-sun icon" : "bx bx-moon icon";

    // Update mobile menu icon and text
    const mobileIcon = mobileDarkmodeBtn.querySelector("i");
    const mobileText = mobileDarkmodeBtn.querySelector("span");
    mobileIcon.className = isDark ? "bx bx-sun" : "bx bx-moon";
    mobileText.textContent = isDark ? "Light Mode" : "Dark Mode";
  }

  /** Handles clicks on a status item in the list. */
  function handleStatusClick(event) {
    const status = event.target.closest(".status-link");
    if (!status) return; // Exit if the click wasn't on a status item

    hideAllMainPanels(); // Hide chat/placeholder
    statusView.classList.add("active"); // Show the status viewer

    // Populate the status view with data from the clicked item's attributes
    statusUserName.textContent = status.dataset.name || "Status";
    statusUserImg.src =
      status.dataset.img || status.querySelector("img")?.src || "";
    statusImage.src =
      status.dataset.img || status.querySelector("img")?.src || "";
    statusTime.textContent = new Date().toLocaleTimeString(); // Placeholder time

    // On mobile, show the main section (the status view)
    if (window.innerWidth <= 768)
      container.classList.add("mobile-chat-active");
  }

  /** Closes the full-screen status view. */
  function closeStatusViewHandler() {
    statusView.classList.remove("active");
    showMainTabs(); // Restore the midsection
    container.classList.remove("mobile-chat-active"); // Close main section on mobile
  }

  /** Toggles the mobile kebab menu. */
  function toggleMobileMenu(event) {
    event.stopPropagation(); // Stop click from bubbling to 'document'
    mobileMenu.classList.toggle("active");
  }

  /** Toggles the desktop "New Chat" menu. */
  function toggleNewChatMenu(event) {
    event.stopPropagation(); // Stop click from bubbling to 'document'
    newChatMenu.classList.toggle("active");
  }

  // --- 6. ATTACH EVENT LISTENERS ---
  // "Wire up" the DOM elements to their handler functions.

  // Sidebar Tab Switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", handleTabClick);
  });

  // Dark Mode
  toggleModeButton.addEventListener("click", toggleDarkMode);

  // Profile & Settings
  profileButton.addEventListener("click", () => {
    // Only show the modal if we aren't already in the settings panel
    if (!profileSettingsPanel.classList.contains("active")) {
      profileModal.classList.add("active");
    }
  });
  closeProfileModal.addEventListener("click", () =>
    profileModal.classList.remove("active")
  );
  profileModal.addEventListener("click", (e) => {
    // Close modal if clicking on the background overlay
    if (e.target.id === "profile-modal")
      profileModal.classList.remove("active");
  });
  editProfileButton.addEventListener("click", () => {
    profileModal.classList.remove("active"); // Close the modal
    showPanel(profileSettingsPanel); // Show the edit panel
  });
  settingsButton.addEventListener("click", () =>
    showPanel(generalSettingsPanel)
  );
  backButtonProfile.addEventListener("click", showMainTabs);
  backButtonSettings.addEventListener("click", showMainTabs);

  // Status
  statusContentPanel.addEventListener("click", handleStatusClick);
  closeStatusView.addEventListener("click", closeStatusViewHandler);

  // Mobile Menu
  mobileMenuBtn.addEventListener("click", toggleMobileMenu);
  mobileProfileBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    profileButton.click(); // Simulate a click on the main profile button
  });
  mobileDarkmodeBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    toggleDarkMode();
  });
  mobileSettingsBtn.addEventListener("click", () => {
    mobileMenu.classList.remove("active");
    settingsButton.click(); // Simulate a click on the main settings button
  });

  // New Chat/Group
  newChatBtn.addEventListener("click", toggleNewChatMenu);

  // Mobile Back Button (in main chat header)
  mobileBackBtn.addEventListener("click", () =>
    container.classList.remove("mobile-chat-active")
  );

  // --- 7. EXPOSE GLOBAL HELPERS ---
  // Expose key functions to the 'window' object so other scripts
  // (like groupCreation.js, contacts.js) can call them.
  window.showPanel = showPanel;
  window.showMainTabs = showMainTabs;

  // (No initialization needed, as default state is set by CSS/HTML)
});