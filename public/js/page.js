document.addEventListener("DOMContentLoaded", () => {
  // --- 1. DOM Element Selections ---
  // Group all your selectors at the top.
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  const loginBtn = document.querySelector(".login");
  const signupBtns = document.querySelectorAll(".signup");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const body = document.body;

  // --- 2. Handler Functions ---
  // Create named functions for each action.

  /** Toggles the mobile navigation menu. */
  function toggleMobileMenu() {
    navLinks.classList.toggle("active");
  }

  /** Opens the login page in a new tab. */
  function openLogin() {
    window.open("/login", "_blank");
  }

  /** Opens the signup page in a new tab. */
  function openSignup() {
    window.open("/signup", "_blank");
  }

  /** Toggles the theme between light and dark. */
  function toggleTheme() {
    // Check what the new theme should be
    const isDarkMode = body.classList.contains("dark-mode");
    const newTheme = isDarkMode ? "light" : "dark";
    applyTheme(newTheme);
  }

  /**
   * Applies a specific theme (dark or light) to the page.
   * This function handles everything: class, icon, and localStorage.
   */
  function applyTheme(theme) {
    if (theme === "dark") {
      body.classList.add("dark-mode");
      darkModeToggle.classList.replace("fa-moon", "fa-sun");
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.remove("dark-mode");
      darkModeToggle.classList.replace("fa-sun", "fa-moon");
      localStorage.setItem("theme", "light");
    }
  }

  /** Checks localStorage and applies the saved theme on page load. */
  function initializeTheme() {
    const savedTheme = localStorage.getItem("theme") || "light"; // Default to light
    applyTheme(savedTheme);
  }

  // --- 3. Attach Event Listeners ---
  // "Wire up" all the elements to their functions.
  hamburger.addEventListener("click", toggleMobileMenu);
  loginBtn.addEventListener("click", openLogin);
  signupBtns.forEach((btn) => {
    btn.addEventListener("click", openSignup);
  });
  darkModeToggle.addEventListener("click", toggleTheme);

  // --- 4. Initialization ---
  // Run any code needed on page load.
  initializeTheme();
});