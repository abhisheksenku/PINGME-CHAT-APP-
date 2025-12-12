document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  // Forms & Modals
  const profileForm = document.querySelector(".profile-form");
  const profileModal = document.getElementById("profile-modal");
  const closeProfileModal = document.getElementById("close-profile-modal");

  // Modal Display Fields (Read-only)
  const displayName = document.getElementById("profile-modal-name");
  const displayAbout = document.getElementById("profile-modal-about");
  const displayEmail = document.getElementById("profile-modal-email");

  // Editable Form Fields (Read/Write)
  const profileNameInput = document.getElementById("profile-name");
  const profileAboutInput = document.getElementById("profile-about");

  // Profile Picture Elements
  const sidebarPic = document.getElementById("sidebar-profile-pic");
  const profileEditPic = document.getElementById("profile-edit-pic");
  const profileModalPic = document.getElementById("profile-modal-pic");

  // --- 2. State ---
  // Get the authentication token from session storage
  const token = sessionStorage.getItem("token");

  // --- 3. Handler Functions ---

  /**
   * Handles the submission of the user's profile update form.
   * Sends the new 'name' and 'about' info to the server.
   * @param {Event} event - The "submit" event object.
   */
  async function handleProfileSubmit(event) {
    // Prevent the form from doing a default page reload
    event.preventDefault();

    const updatedData = {
      name: profileNameInput.value.trim(),
      about: profileAboutInput.value.trim(),
    };

    try {
      // Send the 'updatedData' payload to the 'PUT' endpoint
      const response = await axios.put(
        `${BASE_URL}/api/user/profile/update/me`,
        updatedData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Use the server's response to update the UI
      populateProfileData(response.data.user);

      showToast("Profile updated successfully!");

      // (Original commented-out code preserved)
      // // Close modal
      // profileModal.classList.remove("active");
      // /// Focus chat input
      // const chatInput = document.getElementById("message-input");
      // if (chatInput) {
      //   chatInput.focus();
      // }
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast("Failed to update profile.");
    }
  }

  /**
   * Handles the 'input' event on the profile name field.
   * Updates all profile pictures in real-time as the user types.
   */
  function handleNameInput() {
    updateProfilePics(profileNameInput.value.trim());
  }

  // --- 4. Helper Functions ---

  /**
   * A reusable helper function to update all profile-related UI
   * elements with new data.
   * @param {object} userData - The user object from the API.
   */
  function populateProfileData(userData) {
    const name = userData.name || "No Name";
    const about = userData.about || "No About Info";

    // Update modal display text
    displayName.textContent = name;
    displayAbout.textContent = about;
    displayEmail.textContent = userData.email || "No Email";

    // Update editable form fields
    if (profileNameInput) profileNameInput.value = name.replace("No Name", "");
    if (profileAboutInput)
      profileAboutInput.value = about.replace("No About Info", "");

    // Update all profile picture placeholders
    updateProfilePics(name);
  }

  /**
   * Updates the 'src' attribute of all profile picture elements
   * based on the first initial of the user's name.
   * @param {string} name - The user's name.
   */
  const updateProfilePics = (name) => {
    // Use the first letter of the name, or "A" as a fallback
    const initial = name ? name[0].toUpperCase() : "A";
    const newSrc = `https://placehold.co/120x120/695cfe/ffffff?text=${initial}`;

    // Update all three profile pic locations
    if (sidebarPic) sidebarPic.src = newSrc;
    if (profileEditPic) profileEditPic.src = newSrc;
    if (profileModalPic) profileModalPic.src = newSrc;
  };

  // --- 5. Initialization Function ---

  /**
   * Fetches the current user's profile data from the server
   * as soon as the page loads.
   */
  async function initializeProfile() {
    if (!token) {
      console.warn(
        "No token found. Profile data will not be fetched on load."
      );
      // Note: The axios interceptor will handle any 401 errors
      // if the user tries to perform an action.
      return;
    }

    try {
      // Fetch the user's own profile data
      const response = await axios.get(`${BASE_URL}/api/user/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Use our helper function to populate the page
      populateProfileData(response.data.userData);
    } catch (error) {
      console.error("Unable to fetch user info:", error);
      // The axios interceptor will likely catch 401s and redirect.
      // This toast is for other errors (e.g., server down).
      if (error.response?.status !== 401) {
        showToast("Unable to fetch profile info");
      }
    }
  }

  // --- 6. Attach Event Listeners ---
  // "Wire up" the DOM elements to their handler functions.

  // Handle the profile form submission
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileSubmit);
  }

  // Handle live updates to the profile picture
  if (profileNameInput) {
    profileNameInput.addEventListener("input", handleNameInput);
  }

  // --- 7. Run Initialization ---
  // Fetch the user's data when the page is ready.
  initializeProfile();
});