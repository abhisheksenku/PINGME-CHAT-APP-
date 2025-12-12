document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  const form = document.getElementById("resetPasswordForm");
  const messageEl = document.getElementById("message");
  const errorEl = document.getElementById("error");

  let token; // Variable to store the token extracted from the URL

  // --- 2. Handler Functions ---

  /**
   * Handles the password reset form submission.
   * This is an async function because it waits for the axios API call.
   * @param {Event} event - The "submit" event object.
   */
  async function handleResetSubmit(event) {
    // Stop the form from causing a default page reload
    event.preventDefault();

    // Get values from the form
    const newPassword = form.newPassword.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    // Clear any previous messages
    messageEl.textContent = "";
    errorEl.textContent = "";

    // --- Validation Checks ---
    if (!newPassword || !confirmPassword) {
      errorEl.textContent = "Please enter and confirm your new password.";
      return;
    }
    if (newPassword !== confirmPassword) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }

    // --- API Call ---
    try {
      // Send the new password and token to the backend
      const res = await axios.post(
        `${BASE_URL}/api/auth/reset-password/${token}`, // Pass token in URL
        { newPassword, confirmPassword } // Pass passwords in body
      );

      // --- Success Handling ---
      messageEl.textContent = res.data.message || "Password reset successful!";
      form.reset();
      
      // Alert the user and prepare for redirect
      alert("Your password has been successfully updated! Redirecting to login...");
      
      // Redirect to login after a short delay so they can read the message
      setTimeout(() => {
        window.location.href = "/login"; // Redirect to login page
      }, 2000);

    } catch (err) {
      // --- Error Handling ---
      errorEl.textContent =
        err.response?.data?.error || "Invalid token or an error occurred.";
      console.error("Reset password error:", err);
    }
  }

  /**
   * Initializes the page by extracting and validating the reset token from the URL.
   */
  function initializePage() {
    // Get the full URL path (e.g., "/reset-password/abc123xyz")
    const pathParts = window.location.pathname.split("/");
    
    // Get the last part of the URL, which should be the token
    token = pathParts[pathParts.length - 1];

    // If no token is found, show an error and hide the form
    if (!token) {
      errorEl.textContent = "Invalid or missing reset token.";
      form.style.display = "none";
    }
  }

  // --- 3. Attach Event Listeners ---
  // "Wire up" the form's 'submit' event to our handler function.
  form.addEventListener("submit", handleResetSubmit);

  // --- 4. Initialization ---
  // Run the token check as soon as the page loads.
  initializePage();
});