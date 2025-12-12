document.addEventListener("DOMContentLoaded", () => {
  // --- 1. AUTHENTICATION GUARD ---
  // Immediately check for a token. If it's missing, stop executing
  // and redirect the user to the login page.
  const token = sessionStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  // --- 2. DOM ELEMENT SELECTIONS ---
  // Group all element queries at the top for easy reference.

  // Update Password Form
  const updatePasswordForm = document.getElementById("update-password-form");
  const currentPasswordInput = document.getElementById("current-password");
  const newPasswordInput = document.getElementById("new-password");
  const confirmPasswordInput = document.getElementById("confirm-password");

  // Delete Account Elements
  const deleteAccountBtn = document.getElementById("delete-account-btn");
  const deleteAccountModal = document.getElementById("delete-account-modal");
  const deleteAccountForm = document.getElementById("delete-account-form");
  const deleteConfirmPassword = document.getElementById(
    "delete-confirm-password"
  );
  const cancelAccountDeleteBtn = document.getElementById(
    "cancel-account-delete-btn"
  );

  // Shared UI
  const toast = document.getElementById("toast-notification");

  // --- 3. STATE ---
  let toastTimer; // Holds the timeout ID for the toast

  // --- 4. HELPER FUNCTIONS ---

  /**
   * Displays a toast notification message.
   * @param {string} message - The text to display.
   * @param {boolean} [isError=false] - True if the toast should be styled as an error.
   */
  function showToast(message, isError = false) {
    if (!toast) return; // Do nothing if toast element doesn't exist

    clearTimeout(toastTimer); // Clear any existing toast timer
    toast.textContent = message;
    toast.className = "show"; // Reset classes and show

    if (isError) {
      toast.classList.add("error"); // Add error class for red styling
    }

    // Set a timer to hide the toast after 3 seconds
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // --- 5. EVENT HANDLERS ---
  // Functions that contain the logic for each event.

  /**
   * Handles the submission of the "Update Password" form.
   * Validates input and sends it to the API.
   * @param {Event} event - The "submit" event object.
   */
  async function handleUpdatePasswordSubmit(event) {
    event.preventDefault(); // Stop the form from reloading the page

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // --- Client-side validation ---
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", true);
      return;
    }
    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters.", true);
      return;
    }

    try {
      // Send the data to the API
      const response = await axios.post(
        `${BASE_URL}/api/user/profile/update-password/me`,
        { currentPassword, newPassword, confirmPassword },
        // Send the token in the 'Authorization' header
        { headers: { Authorization: token } } // Note: No 'Bearer ' prefix, adjust if your middleware needs it
      );

      showToast(response.data.message || "Password updated successfully!");
      updatePasswordForm.reset(); // Clear the form
    } catch (error) {
      // Handle errors from the API (e.g., "Current password incorrect")
      console.error("Error updating password:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update password.";
      showToast(errorMessage, true);
    }
  }

  /** Shows the delete account confirmation modal. */
  function openDeleteModal() {
    deleteAccountModal.classList.add("active");
  }

  /** Hides the delete account confirmation modal. */
  function closeDeleteModal() {
    deleteAccountModal.classList.remove("active");
    deleteAccountForm.reset(); // Clear the password field
  }

  /**
   * Handles the final "Delete Account" form submission.
   * Sends a DELETE request to the API with the user's password.
   * @param {Event} event - The "submit" event object.
   */
  async function handleDeleteAccountSubmit(event) {
    event.preventDefault();
    const password = deleteConfirmPassword.value;

    if (!password) {
      showToast("Password is required to delete your account.", true);
      return;
    }

    try {
      // Send the DELETE request
      const response = await axios.delete(
        `${BASE_URL}/api/user/profile/delete/me`,
        {
          headers: { Authorization: token },
          // For axios.delete, the payload must be in a 'data' property
          data: { password: password },
        }
      );

      showToast(response.data.message || "Account deleted successfully.");

      // Clean up local session and redirect the user
      sessionStorage.removeItem("token");
      setTimeout(() => {
        window.location.href = "/login"; // Redirect to login page
      }, 2000); // Wait 2s for user to read the message
    } catch (error) {
      // Handle errors (e.g., "Password incorrect")
      console.error("Error deleting account:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to delete account. Please try again.";
      showToast(errorMessage, true);
      deleteConfirmPassword.value = ""; // Clear password field on error
    }
  }

  // --- 6. ATTACH EVENT LISTENERS ---
  // "Wire up" the DOM elements to their handler functions.
  // We check if the element exists first to prevent errors.

  if (updatePasswordForm) {
    updatePasswordForm.addEventListener("submit", handleUpdatePasswordSubmit);
  }

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", openDeleteModal);
  }

  if (cancelAccountDeleteBtn) {
    cancelAccountDeleteBtn.addEventListener("click", closeDeleteModal);
  }

  if (deleteAccountForm) {
    deleteAccountForm.addEventListener("submit", handleDeleteAccountSubmit);
  }
});