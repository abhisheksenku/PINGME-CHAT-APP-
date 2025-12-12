document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  const form = document.getElementById("forgotPasswordForm");
  const toast = document.getElementById("toast-notification");

  // --- 2. Handler Functions ---

  /**
   * Handles the form submission for password reset.
   * @param {Event} event - The "submit" event object.
   */
  async function handleFormSubmit(event) {
    event.preventDefault(); // Stop the form from reloading the page

    const email = form.email.value.trim();

    if (!email) {
      showToast("Please enter your email.", "error");
      return;
    }

    try {
      // Send the email to the backend API
      const response = await axios.post(
        `${BASE_URL}/api/auth/forgot-password`,
        { email },
        { headers: { "Content-Type": "application/json" } }
      );

      // Show success toast
      const message = response.data.message || "Reset link sent to your email.";
      showToast(message, "success");
      form.reset();
      
    } catch (err) {
      // Show error toast
      let errorMessage = "Error connecting to server.";
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = err.response.data.error;
      }
      showToast(errorMessage, "error");
      console.error(err);
    }
  }

  /**
   * Displays a toast notification.
   * @param {string} message - The text to display.
   * @param {string} type - The type of toast ('success', 'error', or default).
   */
  function showToast(message, type = "default") {
    // Clear any existing timeouts
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    toast.textContent = message;
    
    // Remove old type classes
    toast.classList.remove("success", "error");

    // Add new type class
    if (type === "success") {
      toast.classList.add("success");
    } else if (type === "error") {
      toast.classList.add("error");
    }

    // Show the toast
    toast.classList.add("show");

    // Set a timer to hide it after 3 seconds
    toast.timeoutId = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // --- 3. Attach Event Listeners ---
  form.addEventListener("submit", handleFormSubmit);
});