document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  // Get the one element we need to interact with.
  const loginForm = document.getElementById("loginForm");

  // --- 2. Handler Functions ---

  /**
   * Handles the login form submission.
   * This is an async function because it waits for the axios API call.
   * @param {Event} event - The "submit" event object.
   */
  async function handleLoginSubmit(event) {
    // Stop the form from causing a default page reload
    event.preventDefault();

    // Get all the form data in a modern, simple way
    const formData = new FormData(loginForm);
    const formValues = Object.fromEntries(formData.entries());

    console.log("Attempting to log in with:", formValues);

    // Try to send the data to the server
    try {
      // Use axios to send a POST request to the login API endpoint
      const response = await axios.post(
        `${BASE_URL}/api/auth/login`, // BASE_URL from config.js
        formValues
      );

      // --- Success Handling ---
      console.log("Login successful:", response.data);

      // Store the token in Session Storage.
      // sessionStorage is cleared when the browser tab is closed.
      sessionStorage.setItem("token", response.data.token);

      loginForm.reset(); // Clear the email/password fields

      // Redirect the user to the main chat application
      window.location.href = "/chat";

    } catch (error) {
      // --- Error Handling ---
      // If the API call fails, this 'catch' block will run
      displayLoginError(error);
    }
  }

  /**
   * Displays a user-friendly alert based on the API error.
   * @param {Error} error - The error object caught from axios.
   */
  function displayLoginError(error) {
    console.error("Error during login:", error);

    // Check if the error is a 401 "Unauthorized" status.
    // This is the correct status for invalid credentials.
    if (error.response && error.response.status === 401) {
      alert("Invalid email or password. Please try again.");
    } else {
      // For all other errors (e.g., server down, network issue)
      alert("Something went wrong. Please try again.");
    }
  }

  // --- 3. Attach Event Listeners ---
  // "Wire up" the form's 'submit' event to our handler function.
  loginForm.addEventListener("submit", handleLoginSubmit);

  // (No initialization step needed for this page)
});