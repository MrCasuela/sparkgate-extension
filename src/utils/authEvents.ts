export const SESSION_EXPIRED_EVENT = 'sparkgate:unauthorized';

export function dispatchSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}