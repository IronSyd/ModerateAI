// Force dark input styling - JavaScript override
export function forceDarkInputs() {
  const applyDarkStyles = () => {
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"], input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])') as NodeListOf<HTMLInputElement>;
    
    inputs.forEach(input => {
      input.style.setProperty('background-color', '#1e293b', 'important');
      input.style.setProperty('border-color', '#475569', 'important');
      input.style.setProperty('color', 'white', 'important');
      
      // Override placeholder color
      const style = document.createElement('style');
      style.textContent = `
        input::placeholder {
          color: #94a3b8 !important;
        }
      `;
      if (!document.head.querySelector('[data-dark-input-override]')) {
        style.setAttribute('data-dark-input-override', 'true');
        document.head.appendChild(style);
      }
    });
  };

  // Apply immediately
  applyDarkStyles();
  
  // Apply when DOM changes
  const observer = new MutationObserver(() => {
    applyDarkStyles();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Apply on window load
  window.addEventListener('load', applyDarkStyles);
  
  // Apply periodically to catch any dynamic changes
  setInterval(applyDarkStyles, 1000);
}