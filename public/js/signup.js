document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  // Select the form we need to interact with.
  const signupForm = document.getElementById("signupForm");

  // --- 2. Handler Functions ---

  /**
   * Handles the form submission event.
   * This is an async function because it waits for the API call (axios).
   * @param {Event} event - The "submit" event object.
   */
  async function handleSignupSubmit(event) {
    // Prevent the form from doing a default page reload
    event.preventDefault();

    // Get all the form data in a simple, modern way
    const formData = new FormData(signupForm);
    const formValues = Object.fromEntries(formData.entries());

    console.log("Submitting these values:", formValues);

    // Try to send the data to the server
    try {
      // Use axios to send a POST request to the signup API endpoint
      // We 'await' the response from the server
      const response = await axios.post(
        `${BASE_URL}/api/auth/signup`, // Make sure BASE_URL is in config.js
        formValues
      );

      // --- Success Handling ---
      console.log("User registered:", response.data);
      alert("User registered successfully!");

      signupForm.reset(); // Clear the form fields
      window.location.href = "/login"; // Redirect to the login page

    } catch (error) {
      // --- Error Handling ---
      // If the API call fails, this 'catch' block will run
      displaySignupError(error);
    }
  }

  /**
   * Displays a user-friendly alert based on the API error.
   * @param {Error} error - The error object caught from axios.
   */
  function displaySignupError(error) {
    console.error("Error during signup:", error);

    // Check if the server sent a specific error message
    // (e.g., "Email already in use")
    if (error.response?.data?.error) {
      alert(error.response.data.error);
    } else {
      // Generic fallback message
      alert("Something went wrong. Please try again.");
    }
  }

  // --- 3. Attach Event Listeners ---
  // "Wire up" the form's 'submit' event to our handler function.
  // Note: We do *not* call handleSignupSubmit() here.
  // We pass the function itself as the "recipe" to run on submit.
  signupForm.addEventListener("submit", handleSignupSubmit);
  
  // (No initialization step needed for this page)
});