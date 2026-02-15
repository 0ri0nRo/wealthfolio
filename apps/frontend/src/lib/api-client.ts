// Rileva se siamo in modalità Tauri o Web
export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Base URL per le API web
export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
};
