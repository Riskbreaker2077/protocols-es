// Tema claro/oscuro con preferencia persistente. Los botones usan iconos SVG;
// el estado se marca en <html data-theme> y CSS decide qué icono mostrar.
(function(){
  var saved = null;
  try { saved = localStorage.getItem('protocolos-theme'); } catch(e){}
  var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function apply(){
    document.documentElement.setAttribute('data-theme', theme);
  }
  apply();
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', function(){
      theme = theme === 'dark' ? 'light' : 'dark';
      apply();
      try { localStorage.setItem('protocolos-theme', theme); } catch(e){}
    });
  });
})();
