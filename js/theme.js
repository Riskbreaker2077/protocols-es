// Tema claro/oscuro con preferencia persistente. Los botones usan iconos SVG;
// el estado se marca en <html data-theme> y CSS decide qué icono mostrar.
// El favicon de la pestaña acompaña al tema: sol en modo diurno, luna en nocturno.
(function(){
  var FAVICON = {
    light: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
      "<circle cx='12' cy='12' r='5' fill='%23f5a524'/>" +
      "<g stroke='%23f5a524' stroke-width='2.2' stroke-linecap='round'>" +
      "<path d='M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M19.2 4.8l-1.8 1.8M6.6 17.4l-1.8 1.8'/></g></svg>",
    dark: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
      "<path d='M21 14.6A9 9 0 0 1 9.4 3 9 9 0 1 0 21 14.6Z' fill='%2319aad8'/></svg>"
  };

  var saved = null;
  try { saved = localStorage.getItem('protocolos-theme'); } catch(e){}
  var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function setFavicon(){
    var link = document.querySelector('link[rel~="icon"]');
    if (!link){
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + FAVICON[theme];
  }
  function apply(){
    document.documentElement.setAttribute('data-theme', theme);
    setFavicon();
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
