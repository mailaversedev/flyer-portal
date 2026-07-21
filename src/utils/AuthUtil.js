export const getTokenExpiryMs = (token) => {
  if (!token) return null;

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = window.atob(base64);
    const payload = JSON.parse(jsonPayload);

    if (!payload?.exp) {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const expiryMs = getTokenExpiryMs(token);

  if (!expiryMs) {
    return true;
  }

  return expiryMs <= Date.now();
};

export const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");

    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

export const getStoredUserRole = () => getStoredUser()?.role || null;

export const isSuperAdmin = () => getStoredUserRole() === "super-admin";
