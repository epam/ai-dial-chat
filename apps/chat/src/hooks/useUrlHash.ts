import { useEffect, useState } from 'react';

export const useUrlHash = () => {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const handleHash = () => {
      const newHash = window.location.hash;

      setHash(newHash);
    };
    handleHash();

    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  return {
    hash,
  };
};
