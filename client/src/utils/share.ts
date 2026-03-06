export const buildShareLinkUrl = (shareId: string, clientDomain?: string): string => {
  const origin = clientDomain?.trim() || window.location.origin;
  return `${origin}/share/${shareId}`;
};
