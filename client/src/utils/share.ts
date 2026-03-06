export const buildShareLinkUrl = (shareId: string): string => {
  return `${window.location.origin}/share/${shareId}`;
};
