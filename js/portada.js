/* Inicio: abre la portada (giro de las 9 fichas), la cierra al tocar fuera
   de las fichas o con Escape, y recuerda durante la sesión si quedó abierta,
   para que al volver de un capítulo aparezca abierta. */
(function(){
  var cube = document.getElementById('cube');
  if (!cube) return;
  var openBtn = document.getElementById('cubeOpen');
  var hint = document.getElementById('coverHint');
  var KEY = 'protocolos-portada-abierta';

  function open(animate, fromKeyboard){
    if (cube.classList.contains('is-open')) return;
    if (!animate) cube.classList.add('no-anim');
    cube.classList.add('is-open');
    if (hint) hint.classList.add('gone');
    cube.querySelectorAll('.back').forEach(function(el){ el.removeAttribute('tabindex'); });
    try { sessionStorage.setItem(KEY, '1'); } catch(e){}
    if (!animate){
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ cube.classList.remove('no-anim'); }); });
    }
    // con teclado, el foco pasa al primer capítulo (el botón desaparece)
    if (fromKeyboard){
      var first = cube.querySelector('.back');
      if (first) first.focus({preventScroll: true});
    }
  }

  function close(fromKeyboard){
    if (!cube.classList.contains('is-open')) return;
    cube.classList.add('closing');            // giro de vuelta en orden inverso (S → P)
    cube.classList.remove('is-open');
    if (hint) hint.classList.remove('gone');
    cube.querySelectorAll('.back').forEach(function(el){ el.setAttribute('tabindex', '-1'); });
    try { sessionStorage.removeItem(KEY); } catch(e){}
    setTimeout(function(){ cube.classList.remove('closing'); }, 1300);
    if (fromKeyboard) openBtn.focus({preventScroll: true});
  }

  openBtn.addEventListener('click', function(e){ open(true, e.detail === 0); });

  // Con la portada abierta, tocar fuera de las fichas (fondo, márgenes de la
  // carátula o huecos entre fichas) la vuelve a cerrar. Los enlaces inferiores
  // siguen funcionando.
  document.addEventListener('click', function(e){
    if (!cube.classList.contains('is-open')) return;
    // el mismo clic que abre la portada sube hasta aquí: ignorarlo
    if (e.target.closest('#cubeOpen, .back, .home-links a')) return;
    close(false);
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') close(true);
  });

  var wasOpen = false;
  try { wasOpen = sessionStorage.getItem(KEY) === '1'; } catch(e){}
  if (wasOpen) open(false, false);
})();
