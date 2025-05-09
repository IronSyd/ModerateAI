import { useState, useEffect } from 'react';

// Hook to track which articles have been read by the user
export function useReadArticles() {
  // Initialize state from localStorage or empty array if no data exists
  const [readArticles, setReadArticles] = useState<string[]>(() => {
    const savedArticles = localStorage.getItem('readArticles');
    return savedArticles ? JSON.parse(savedArticles) : [];
  });

  // Update localStorage whenever readArticles changes
  useEffect(() => {
    localStorage.setItem('readArticles', JSON.stringify(readArticles));
  }, [readArticles]);

  // Function to mark an article as read
  const markArticleAsRead = (articleId: string) => {
    // Only add to read articles if not already there
    if (!readArticles.includes(articleId)) {
      setReadArticles([...readArticles, articleId]);
    }
  };

  // Function to check if an article has been read
  const hasReadArticle = (articleId: string): boolean => {
    return readArticles.includes(articleId);
  };

  // Function to clear read history
  const clearReadArticles = () => {
    setReadArticles([]);
  };

  return {
    readArticles,
    markArticleAsRead,
    hasReadArticle,
    clearReadArticles
  };
}