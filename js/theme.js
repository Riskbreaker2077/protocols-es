// Tema claro/oscuro con preferencia persistente.
(function(){
  var saved = null;
  try { saved = localStorage.getItem('protocolos-theme'); } catch(e){}
  var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  function label(){
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  }
  label();
  document.addEventListener('DOMContentLoaded', label);
  window.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function(){
      theme = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('protocolos-theme', theme); } catch(e){}
      btn.textContent = theme === 'dark' ? '☀' : '☾';
    });
  });
})();
