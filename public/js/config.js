//const BASE_URL = ""; when we are running both frontend and backend on same server
//but below i wrote this just for understanding
const BASE_URL = "http://localhost:3000";
axios.interceptors.response.use(
  // If the response is successful, just return it.
  (response) => {
    return response;
  },
  // If the response has an error...
  (error) => {
    // Check if the error is a 401 (Unauthorized / Token Expired)
    if (error.response && error.response.status === 401) {
      // 1. Show a clear message
      alert("Your session has expired. Please log in again.");
      
      // 2. Clear any old session data
      sessionStorage.removeItem("token");
      
      // 3. Redirect the user to the login page
      window.location.href = "/login";
    }

    // For all other errors, just let them happen normally.
    return Promise.reject(error);
  }
);