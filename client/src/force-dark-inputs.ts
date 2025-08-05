// Force dark input styling - JavaScript override
export function forceDarkInputs() {
  const applyDarkStyles = () => {
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"], input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])') as NodeListOf<HTMLInputElement>;
    
    inputs.forEach(input => {
      // Try multiple approaches to override the styling
      input.style.setProperty('background-color', '#1e293b', 'important');
      input.style.setProperty('border-color', '#475569', 'important');
      input.style.setProperty('color', 'white', 'important');
      input.style.setProperty('background', '#1e293b', 'important');
      input.style.cssText += '; background-color: #1e293b !important; color: white !important; border-color: #475569 !important;';
      
      // Remove any classes that might be causing white background
      const classList = input.classList;
      classList.forEach(className => {
        if (className.includes('bg-') && !className.includes('bg-slate') && !className.includes('bg-gray')) {
          input.classList.remove(className);
        }
      });
      
      // Add our dark class
      input.classList.add('force-dark-bg');
    });
    
    // Add or update the override style
    let styleEl = document.head.querySelector('[data-dark-input-override]') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-dark-input-override', 'true');
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = `
      input::placeholder,
      input::-webkit-input-placeholder {
        color: #94a3b8 !important;
        opacity: 1 !important;
      }
      
      .force-dark-bg,
      input.force-dark-bg {
        background: #1e293b !important;
        background-color: #1e293b !important;
        border-color: #475569 !important;
        color: white !important;
      }
      
      /* Override any possible theme classes */
      input[class*="bg-background"],
      input[class*="bg-white"],
      input[class*="bg-"] {
        background: #1e293b !important;
        background-color: #1e293b !important;
        color: white !important;
      }
    `;
  };

  // Delay initial application to let theme load first
  setTimeout(applyDarkStyles, 100);
  setTimeout(applyDarkStyles, 500);
  setTimeout(applyDarkStyles, 1000);
  
  // Apply when DOM changes
  const observer = new MutationObserver(() => {
    setTimeout(applyDarkStyles, 50);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  // Apply on window load
  window.addEventListener('load', () => {
    setTimeout(applyDarkStyles, 100);
  });
  
  // Apply periodically to catch any dynamic changes
  setInterval(applyDarkStyles, 500);
}