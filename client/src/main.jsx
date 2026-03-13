import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { UserContextProvider } from "./contexts/UserContext.jsx";
import { ErrorBoundary } from "./hooks/ErrorBoundry.jsx";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <UserContextProvider>
      <App />
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </UserContextProvider>
  </ErrorBoundary>
);
