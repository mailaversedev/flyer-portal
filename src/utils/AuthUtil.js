export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = window.atob(base64);
    const payload = JSON.parse(jsonPayload);

    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};
