/**
 * Utility functions for managing page scrolling behavior
 */

/**
 * Resets the scroll position to the top of the page
 * This is more aggressive than just window.scrollTo(0, 0)
 */
export function forceScrollToTop() {
  // First try the standard approach
  window.scrollTo(0, 0);
  
  // Then use a more aggressive approach if needed
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  
  // As a last resort, try to use scrollIntoView on the topmost element
  const topElement = document.querySelector('body > div');
  if (topElement) {
    topElement.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
}

/**
 * Prevents scrolling by temporarily disabling it
 * @param duration - How long to prevent scrolling in milliseconds
 */
export function preventScrolling(duration: number = 500) {
  const originalStyle = document.body.style.cssText;
  
  // Disable scrolling
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100%';
  
  // Re-enable after duration
  setTimeout(() => {
    document.body.style.cssText = originalStyle;
  }, duration);
}

/**
 * Initializes scroll position management for the dashboard
 * Call this when the dashboard component mounts
 */
export function initDashboardScroll() {
  // Force scroll to top immediately
  forceScrollToTop();
  
  // Prevent scrolling for a short time
  preventScrolling(300);
  
  // Set up a mutation observer to watch for content changes that might trigger scrolling
  const observer = new MutationObserver((mutations) => {
    // When content changes, reset scroll position
    forceScrollToTop();
  });
  
  // Start observing the main content area
  const contentArea = document.querySelector('main') || document.body;
  observer.observe(contentArea, { 
    childList: true, 
    subtree: true,
    attributes: true,
    characterData: true
  });
  
  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}