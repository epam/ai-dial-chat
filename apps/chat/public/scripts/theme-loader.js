try {
  document.documentElement.className = JSON.parse(localStorage.getItem('settings') || '{}').theme || '';
} catch(e) { 
  console.error(e); 
}