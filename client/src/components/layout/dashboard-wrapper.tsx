import React, { useEffect, ReactNode } from 'react';

interface DashboardWrapperProps {
  children: ReactNode;
}

/**
 * A wrapper component that handles scroll position management 
 * specifically for the dashboard to prevent auto-scrolling issues
 */
const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  // Control scroll position when the component mounts and updates
  useEffect(() => {
    // Define a function to handle scrolling to top
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Initial scroll to top
    scrollToTop();
    
    // Add a class to the body to apply specific CSS rules
    document.body.classList.add('dashboard-view');
    
    // Set up multiple scroll checks to ensure it stays at the top
    const timeouts = [
      setTimeout(scrollToTop, 0),
      setTimeout(scrollToTop, 50),
      setTimeout(scrollToTop, 200)
    ];

    // Clean up
    return () => {
      // Remove the body class
      document.body.classList.remove('dashboard-view');
      
      // Clear all timeouts
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return (
    <div className="dashboard-wrapper" id="dashboard-top">
      {children}
    </div>
  );
};

export default DashboardWrapper;