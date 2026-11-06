/* Protocolos (proyecto no oficial) — lógica del sitio, reproductor y lector.
   Sin checks de red en runtime: la disponibilidad de PDFs, pistas y duraciones
   viene precomputada en js/data.json. */
(function(){
'use strict';

var DATA = null;
var state = { chapter: null, trackIndex: -1, transcript: [], currentPara: -1 };
var CH_ART = {
  '00_introduccion':'assets/img/c0_introduccion.png',
  '01_dormir':'assets/img/c1_dormir.png',
  '02_ejercicio':'assets/img/c2_ejercicio.png',
  '03_control_del_estres':'assets/img/c3_estres.png',
  '04_nutricion':'assets/img/c4_nutricion.png',
  '05_luz':'assets/img/c5_luz.png',
  '06_enfoque':'assets/img/c6_enfoque.png',
  '07_crecimiento_personal':'assets/img/c7_crecimiento.png'
};
var SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75];
var speedIdx = 1;

var ICO = {
  play: '<svg class="ico-svg ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5Z" fill="currentColor"/></svg>',
  pause: '<svg class="ico-svg ico-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor"/></svg>',
  book: '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.6C10.4 4.3 8.3 3.7 5.5 3.7c-.8 0-1.5.06-2.2.17v13.9c.7-.11 1.4-.17 2.2-.17 2.8 0 4.9.6 6.5 1.9 1.6-1.3 3.7-1.9 6.5-1.9.8 0 1.5.06 2.2.17V3.87a13 13 0 0 0-2.2-.17c-2.8 0-4.9.6-6.5 1.9Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 5.6v13.9" stroke="currentColor" stroke-width="1.7"/></svg>',
  arrow: '<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9.5 7H17v7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function $(id){ return document.getElementById(id); }
function fmt(s){
  if (!isFinite(s) || s < 0) s = 0;
  var m = Math.floor(s/60), r = Math.floor(s%60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}
function esc(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ---------- datos ---------- */
function loadData(cb){
  fetch('js/data.json').then(function(r){ return r.json(); }).then(cb)
    .catch(function(){ cb({chapters: []}); });
}

/* "Antes de empezar" para la introducción (00_…), "Capítulo N" para el
   resto (N sale del slug, así la introducción no corre la numeración). */
function chapterLabel(ch){
  var n = parseInt(ch.slug, 10);
  return n ? 'Capítulo ' + n : 'Antes de empezar';
}

/* ---------- tarjetas de capítulos ---------- */
function chapterCard(ch, i){
  var n = ch.tracks.filter(function(t){ return t.available; }).length;
  var conAudio = ch.tracks.length > 0;
  var protos = ch.tracks.filter(function(t){ return !/^00_/.test(t.id); }).length;
  var a = document.createElement('a');
  a.className = 'chapter-card fade-in';
  a.href = 'biblioteca.html?cap=' + encodeURIComponent(ch.slug);
  a.style.animationDelay = (i * 0.05) + 's';
  a.innerHTML =
    '<span class="art"><img src="' + (CH_ART[ch.slug] || 'assets/img/hero.svg') + '" alt="" loading="lazy"></span>' +
    '<span class="body">' +
    '<span class="num">' + esc(chapterLabel(ch)) + '</span>' +
    '<h3>' + esc(ch.titulo) + '</h3>' +
    '<p>' + esc(ch.desc) + '</p>' +
    '<span class="meta">' + (conAudio
      ? (protos ? protos + ' protocolos · ' : '') + n + '/' + ch.tracks.length + (ch.tracks.length === 1 ? ' pista' : ' pistas') + ' de audio'
      : 'Lectura · texto y PDF') + '</span>' +
    '<span class="card-actions">' +
      (conAudio ? '<span class="chip">' + ICO.play + 'Escuchar</span>' : '') +
      '<span class="chip alt" data-reader="' + esc(ch.slug) + '">' + ICO.book + 'Leer</span>' +
    '</span>' +
    '</span>';
  // El chip "Leer" navega al lector en lugar del capítulo.
  a.querySelector('[data-reader]').addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    location.href = 'lector.html?cap=' + encodeURIComponent(ch.slug) + '&lang=es';
  });
  return a;
}
function renderGrid(){
  var grid = $('chaptersGrid');
  if (!grid || !DATA) return;
  grid.innerHTML = '';
  DATA.chapters.forEach(function(ch, i){ grid.appendChild(chapterCard(ch, i)); });
}

/* ---------- índice del lector ---------- */
function renderReaderToc(){
  var toc = $('readerToc');
  if (!toc || !DATA) return;
  toc.innerHTML = '';
  DATA.chapters.forEach(function(ch){
    var a = document.createElement('a');
    a.href = 'lector.html?cap=' + encodeURIComponent(ch.slug) + '&lang=es';
    a.innerHTML =
      '<img class="rt-art" src="' + (CH_ART[ch.slug] || 'assets/img/hero.svg') + '" alt="" loading="lazy">' +
      '<span><span class="rt-t">' + esc(ch.titulo) + '</span><br>' +
      '<span class="rt-s">' + esc(ch.en) + '</span></span>';
    toc.appendChild(a);
  });
}

/* ---------- vista de capítulo (estilo app de música) ---------- */
function renderChapter(slug){
  var idx = DATA.chapters.findIndex(function(c){ return c.slug === slug; });
  if (idx < 0) return false;
  var ch = DATA.chapters[idx];
  state.chapter = ch;
  $('libraryView').hidden = true;
  $('libraryHead').hidden = true;
  var view = $('chapterView');
  view.hidden = false;
  view.classList.add('fade-in');
  document.title = ch.titulo + ' · Protocolos (proyecto no oficial)';
  $('chNum').textContent = chapterLabel(ch);
  $('chTitle').textContent = ch.titulo;
  $('chEn').textContent = ch.en;
  $('chDesc').textContent = ch.desc;
  var art = CH_ART[ch.slug] || 'assets/img/hero.svg';
  var artEl = $('chArt');
  if (artEl){ artEl.src = art; artEl.alt = ''; }
  var pfArt = $('pfArt');
  if (pfArt) pfArt.src = art;
  var readBtn = $('readOnlineBtn');
  if (readBtn) readBtn.href = 'lector.html?cap=' + encodeURIComponent(slug) + '&lang=es';

  // PDFs: disponibilidad precomputada en data.json — sin peticiones de verificación.
  var row = $('pdfRow');
  row.querySelectorAll('.pdf-btn').forEach(function(b){ b.remove(); });
  [['es','Español'],['en','English']].forEach(function(p){
    var dir = p[0], name = p[1];
    var b = document.createElement('a');
    b.className = 'pdf-btn';
    b.rel = 'noopener';
    var url = 'assets/pdf/' + dir + '/' + ch.slug + '.pdf';
    if (ch.pdf && ch.pdf[dir]){
      b.href = url;
      b.setAttribute('download','');
      b.innerHTML = '<span class="flag">' + dir.toUpperCase() + '</span> PDF';
      b.setAttribute('aria-label', 'Descargar PDF en ' + name);
    } else {
      b.classList.add('unavailable');
      b.innerHTML = '<span class="flag">' + dir.toUpperCase() + '</span> PDF';
      b.setAttribute('aria-label', 'PDF en ' + name + ' (próximamente)');
      b.title = 'Próximamente';
    }
    row.appendChild(b);
  });

  // Playlist de pistas (la introducción no tiene audio: se oculta el bloque).
  var list = $('trackList');
  list.innerHTML = '';
  var conAudio = ch.tracks.length > 0;
  list.hidden = !conAudio;
  document.querySelectorAll('.playlist-title, .playlist-sub').forEach(function(el){ el.hidden = !conAudio; });
  var plTitle = document.querySelector('.playlist-title');
  if (plTitle) plTitle.textContent = parseInt(ch.slug, 10) ? 'Protocolos del capítulo' : 'Audiolibro';
  ch.tracks.forEach(function(t, i){
    var el = document.createElement(t.available ? 'button' : 'div');
    el.className = 'track' + (t.available ? '' : ' soon');
    el.setAttribute('role','listitem');
    var dur = t.available && t.duration ? '<span class="t-dur">' + fmt(t.duration) + '</span>' : '<span class="t-dur muted">—</span>';
    el.innerHTML =
      '<span class="t-num">' + (i < 10 ? '0' : '') + (i+1) + '</span>' +
      '<span class="t-body"><span class="t-title">' + esc(t.titulo) + '</span>' +
      '<span class="t-sub">' + (t.available ? 'Disponible' : 'En producción') + '</span></span>' +
      dur +
      (t.available ? '<span class="t-play" aria-hidden="true">' + ICO.play + '</span>' : '<span class="soon-tag">Próximamente</span>');
    if (t.available){
      el.addEventListener('click', function(){ playTrack(i); });
    }
    list.appendChild(el);
  });
  window.scrollTo({top:0, behavior:'smooth'});
  return true;
}

/* ---------- reproductor ---------- */
var audio = null;
function ensureAudio(){ if (!audio) audio = $('audio'); return audio; }

function setPlayingUI(playing){
  var p = $('player');
  p.classList.toggle('is-playing', playing);
}

function playTrack(i){
  var t = state.chapter.tracks[i];
  if (!t || !t.available) return;
  state.trackIndex = i;
  var a = ensureAudio();
  a.src = t.audio;
  a.playbackRate = SPEEDS[speedIdx];
  a.play().catch(function(){});
  $('playerTitle').textContent = t.titulo;
  $('pfChap').textContent = state.chapter.titulo;
  $('pmTitle').textContent = t.titulo;
  $('pmChap').textContent = state.chapter.titulo;
  $('downloadBtn').href = t.audio;
  $('downloadBtn').setAttribute('download', t.id + '.mp3');
  var p = $('player');
  p.classList.add('open');
  p.classList.remove('expanded'); // mini-player por defecto en móvil
  document.body.classList.add('has-player');
  document.querySelectorAll('.track').forEach(function(el, j){
    el.classList.toggle('active', j === i);
  });
  loadTranscript(t);
  $('toggleTranscript').setAttribute('aria-expanded', 'true');
}

function togglePlay(){
  var a = ensureAudio();
  if (!a.src) return;
  if (a.paused){ a.play().catch(function(){}); }
  else { a.pause(); }
}

function nextTrack(){
  if (!state.chapter) return;
  for (var j = state.trackIndex + 1; j < state.chapter.tracks.length; j++){
    if (state.chapter.tracks[j].available){ playTrack(j); return; }
  }
}
function prevTrack(){
  if (!state.chapter) return;
  for (var j = state.trackIndex - 1; j >= 0; j--){
    if (state.chapter.tracks[j].available){ playTrack(j); return; }
  }
}

function loadTranscript(t){
  var panel = $('transcriptPanel');
  state.transcript = [];
  state.currentPara = -1;
  fetch(t.transcript).then(function(r){
    if (!r.ok) throw 0;
    return r.text();
  }).then(function(txt){
    panel.innerHTML = '';
    var first = true;
    txt.split('\n').forEach(function(line){
      line = line.trim();
      if (!line) return;
      if (line.startsWith('#')) return; // títulos del md
      var m = line.match(/^\[(\d+):(\d+)\]\s*(.*)$/);
      var p = document.createElement('p');
      if (m){
        var sec = parseInt(m[1],10)*60 + parseInt(m[2],10);
        var btn = document.createElement('button');
        btn.className = 'ts-btn';
        btn.textContent = m[1] + ':' + m[2];
        btn.addEventListener('click', function(){ seek(sec); });
        p.appendChild(btn);
        p.appendChild(document.createTextNode(m[3]));
        state.transcript.push({sec: sec, el: p});
      } else {
        p.textContent = line;
        if (first && state.transcript.length === 0){ p.style.fontWeight = '600'; p.style.color = 'var(--ink)'; }
      }
      panel.appendChild(p);
      first = false;
    });
    if (!state.transcript.length){
      panel.innerHTML = '<p class="transcript-empty">Este audio aún no tiene transcripción sincronizada.</p>';
    }
  }).catch(function(){
    panel.innerHTML = '<p class="transcript-empty">Transcripción no disponible todavía.</p>';
  });
}

function seek(sec){
  var a = ensureAudio();
  a.currentTime = sec;
  if (a.paused){ a.play().catch(function(){}); }
}

function onTimeUpdate(){
  var a = ensureAudio();
  if (!isFinite(a.duration) || a.duration <= 0) return;
  var pct = (a.currentTime / a.duration) * 100;
  $('progressFill').style.width = pct + '%';
  $('progressBar').setAttribute('aria-valuenow', pct.toFixed(1));
  $('timeCur').textContent = fmt(a.currentTime);
  $('timeLabel').textContent = fmt(a.duration);
  var bar = document.querySelector('#pmProgress i');
  if (bar) bar.style.width = pct + '%';
  // resaltar párrafo actual
  var cur = -1;
  for (var i = 0; i < state.transcript.length; i++){
    if (state.transcript[i].sec <= a.currentTime) cur = i; else break;
  }
  if (cur !== state.currentPara){
    state.transcript.forEach(function(item, j){ item.el.classList.toggle('current', j === cur); });
    state.currentPara = cur;
    if (cur >= 0 && $('transcriptPanel').classList.contains('open')) state.transcript[cur].el.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
}

/* ---------- lector embebido ---------- */
var reader = { slug: null, lang: 'es', cache: {}, fs: parseFloat(localStorage.getItem('readerFs')) || 1.15 };
var SUBHEADS = /^(QUÉ (NO )?HACER|CÓMO FUNCIONA|PREGUNTAS|WHAT (NOT )?TO DO|HOW IT WORKS|COMMON QUESTIONS)\b/i;

function readerInit(){
  var wrap = $('readerContent');
  if (!wrap) return; // no estamos en lector.html
  var params = new URLSearchParams(location.search);
  reader.slug = params.get('cap');
  reader.lang = params.get('lang') === 'en' ? 'en' : 'es';
  applyReaderFs();

  // controles
  document.querySelectorAll('.lang-switch button').forEach(function(b){
    b.setAttribute('aria-pressed', String(b.dataset.lang === reader.lang));
    b.addEventListener('click', function(){
      if (reader.lang === b.dataset.lang) return;
      location.href = 'lector.html?cap=' + encodeURIComponent(reader.slug || '') + '&lang=' + b.dataset.lang;
    });
  });
  $('fsMinus').addEventListener('click', function(){ reader.fs = Math.max(0.9, reader.fs - 0.1); applyReaderFs(); });
  $('fsPlus').addEventListener('click', function(){ reader.fs = Math.min(1.9, reader.fs + 0.1); applyReaderFs(); });

  // drawer de índice
  var drawer = $('tocDrawer'), backdrop = $('drawerBackdrop'), tocBtn = $('tocBtn');
  function setDrawer(open){
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    tocBtn.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
  }
  tocBtn.addEventListener('click', function(){ setDrawer(!drawer.classList.contains('open')); });
  $('tocClose').addEventListener('click', function(){ setDrawer(false); });
  backdrop.addEventListener('click', function(){ setDrawer(false); });
  $('tocDrawerList').addEventListener('click', function(e){
    var a = e.target.closest('a');
    if (a) setDrawer(false);
  });

  // barra de progreso de lectura
  var rp = $('readerProgress');
  window.addEventListener('scroll', function(){
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    rp.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, {passive:true});

  if (DATA && DATA.chapters.length){ renderReaderToc(); }
  if (reader.slug){ loadChapterText(reader.slug, reader.lang); }
}

function applyReaderFs(){
  document.documentElement.style.setProperty('--reader-fs', reader.fs + 'rem');
  localStorage.setItem('readerFs', String(reader.fs));
}

/* Encabezados de protocolo (tipo "h2" en el JSON).
   Vienen como "PROTOCOLO DE SUEÑO Mira la luz…" / "SLEEP PROTOCOL View…".
   Separa la etiqueta en mayúsculas del título y, si el PDF pegó el cuerpo
   del texto al título, lo corta para devolverlo como párrafos. */
var PROTO_LABEL = /^((?:[A-ZÁÉÍÓÚÑÜ]+ )*PROTOCOLO?(?: [A-ZÁÉÍÓÚÑÜ]+)*(?: \d+)?:?)\s+([\s\S]*)$/;
var SUBHEAD_INLINE = /\s(?=(?:QUÉ (?:NO )?HACER|CÓMO FUNCIONA|WHAT (?:NOT )?TO DO|HOW IT WORKS)\b)/;

function splitProtoHeading(text){
  var m = text.match(PROTO_LABEL);
  var label = m ? m[1].replace(/:$/, '') : '';
  var rest = (m ? m[2] : text).trim();
  var title = rest, body = '';
  if (rest.length > 160){
    var cut = rest.search(SUBHEAD_INLINE);
    var mm;
    if (cut < 0 && (mm = rest.match(/\)\s+(?=[A-ZÁÉÍÓÚÑ])/))) cut = mm.index + 1;
    if (cut < 0 && (mm = rest.match(/[.!?]\s/))) cut = mm.index + 1;
    if (cut > 0){ title = rest.slice(0, cut).trim(); body = rest.slice(cut).trim(); }
  }
  return {label: label, title: title, body: body};
}

/* Índice del drawer: Introducción + cada encabezado de protocolo presente
   en el texto, en orden. Todas las entradas apuntan a un ancla real. */
function buildReaderToc(headings, lang){
  var entries = [];
  var n = 0;
  headings.forEach(function(h){
    if (h.isChapterTitle) entries.push({id: h.id, title: lang === 'en' ? 'Introduction' : 'Introducción', num: '·'});
    else entries.push({id: h.id, title: h.title, num: 'P' + (++n)});
  });
  return entries;
}

function buildTocDrawer(entries){
  var list = $('tocDrawerList');
  list.innerHTML = '';
  entries.forEach(function(h){
    if (!h.id) return;
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.innerHTML = '<span class="tocd-num">' + h.num + '</span><span class="tocd-t">' + esc(h.title) + '</span>';
    list.appendChild(a);
  });
}

/* URLs de las referencias → enlaces cortos legibles (dominio/…) */
function linkificar(txt){
  return esc(txt).replace(/https?:\/\/[^\s<]+[^\s<.,;:)\]]/g, function(url){
    var corto = url.replace(/^https?:\/\/(www\.)?/, '');
    if (corto.length > 38) corto = corto.slice(0, 36) + '…';
    return '<a href="' + url + '" target="_blank" rel="noopener">' + corto + '</a>';
  });
}

/* ---------- notas: panel emergente ----------
   Móvil: hoja inferior que sube sobre el texto (se cierra con ✕,
   tocando fuera o deslizando hacia abajo).
   Escritorio: tarjeta flotante junto al número, sin mover la página. */
var notaPanel = (function(){
  var notas = {}, lang = 'es', el, backdrop, refActiva = null, abierto = false;
  var mqDesk = window.matchMedia('(min-width:768px)');

  function build(){
    if (el) return;
    backdrop = document.createElement('div');
    backdrop.className = 'nota-backdrop';
    backdrop.hidden = true;
    el = document.createElement('div');
    el.className = 'nota-pop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'notaPopT');
    el.tabIndex = -1;
    el.hidden = true;
    el.innerHTML =
      '<div class="np-grip" aria-hidden="true"></div>' +
      '<div class="np-head"><span class="np-t" id="notaPopT"></span>' +
      '<button class="icon-btn np-close" type="button"><svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>' +
      '<div class="np-body"></div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(el);
    el.querySelector('.np-close').addEventListener('click', function(){ close(true); });
    backdrop.addEventListener('click', function(){ close(false); });

    // deslizar hacia abajo para cerrar (móvil)
    var y0 = null, dy = 0;
    el.addEventListener('touchstart', function(e){
      if (mqDesk.matches) return;
      var body = el.querySelector('.np-body');
      if (e.target.closest('.np-body') && body.scrollTop > 0) return;
      y0 = e.touches[0].clientY; dy = 0; el.style.transition = 'none';
    }, {passive:true});
    el.addEventListener('touchmove', function(e){
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      el.style.transform = 'translateY(' + dy + 'px)';
    }, {passive:true});
    el.addEventListener('touchend', function(){
      if (y0 === null) return;
      el.style.transition = ''; el.style.transform = '';
      if (dy > 80) close(false);
      y0 = null;
    });
  }

  function place(ref){
    if (!mqDesk.matches){ el.style.left = el.style.top = el.style.width = ''; return; }
    var r = ref.getBoundingClientRect();
    var w = Math.min(440, window.innerWidth - 32);
    var left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), window.innerWidth - w - 16);
    el.style.width = w + 'px';
    el.style.left = (left + window.scrollX) + 'px';
    var h = el.offsetHeight;
    var abajo = r.bottom + 10 + h < window.innerHeight || r.top - 10 - h < 70;
    el.style.top = (abajo ? r.bottom + 10 : r.top - 10 - h) + window.scrollY + 'px';
    el.classList.toggle('arriba', !abajo);
  }

  function open(n, ref){
    if (!notas[n]) return false;
    build();
    if (refActiva) refActiva.classList.remove('activa');
    refActiva = ref; ref.classList.add('activa');
    el.querySelector('.np-t').textContent = (lang === 'es' ? 'Nota ' : 'Note ') + n;
    el.querySelector('.np-close').setAttribute('aria-label', lang === 'es' ? 'Cerrar nota' : 'Close note');
    var body = el.querySelector('.np-body');
    body.innerHTML = linkificar(notas[n]);
    body.scrollTop = 0;
    el.hidden = false;
    backdrop.hidden = mqDesk.matches;
    document.body.classList.toggle('nota-abierta', !mqDesk.matches);
    place(ref);
    void el.offsetWidth; // fuerza el estado inicial para que la transición corra
    el.classList.add('open'); backdrop.classList.add('open');
    abierto = true;
    el.focus({preventScroll:true});
    return true;
  }

  function close(devolverFoco){
    if (!abierto) return;
    abierto = false;
    el.classList.remove('open'); backdrop.classList.remove('open');
    document.body.classList.remove('nota-abierta');
    setTimeout(function(){ if (!abierto){ el.hidden = true; backdrop.hidden = true; } }, 220);
    if (refActiva){
      refActiva.classList.remove('activa');
      if (devolverFoco) refActiva.focus({preventScroll:true});
    }
    refActiva = null;
  }

  document.addEventListener('click', function(e){
    var a = e.target.closest('a[data-nota]');
    if (a){
      e.preventDefault();
      if (abierto && refActiva === a){ close(false); return; }
      open(a.dataset.nota, a);
      return;
    }
    // ↩ en la lista final: volver al punto de lectura y resaltarlo
    var back = e.target.closest('a.ni-back');
    if (back){
      e.preventDefault();
      var ref = document.getElementById(back.getAttribute('href').slice(1));
      if (ref){
        ref.scrollIntoView({block:'center', behavior:'instant'});
        ref.classList.remove('destello'); void ref.offsetWidth; ref.classList.add('destello');
      }
      return;
    }
    if (abierto && mqDesk.matches && !e.target.closest('.nota-pop')) close(false);
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(true); });
  window.addEventListener('resize', function(){ if (abierto) close(false); });

  return {
    setNotas: function(lista, l){
      notas = {}; lang = l;
      (lista || []).forEach(function(n){ notas[n.n] = n.texto; });
    }
  };
})();

function loadChapterText(slug, lang){
  var wrap = $('readerContent');
  fetch('assets/texto/' + lang + '/' + slug + '.json').then(function(r){
    if (!r.ok) throw 0;
    return r.json();
  }).then(function(data){
    wrap.hidden = false;
    wrap.classList.add('fade-in');
    var meta = DATA && DATA.chapters.find(function(c){ return c.slug === slug; });
    var kicker = lang === 'es' ? 'Capítulo · lectura en línea' : 'Chapter · read online';
    wrap.innerHTML =
      '<p class="r-kicker">' + kicker + '</p>' +
      '<h1>' + esc(meta ? meta.titulo : data.title) + '</h1>' +
      '<p class="r-en">' + esc(meta ? meta.en : '') + '</p>' +
      '<div class="reader-content" id="readerBody"></div>';
    var body = $('readerBody');
    var headings = [];
    var seenProto = false;

    function addPara(txt, type){
      txt = txt.trim();
      if (!txt) return;
      var pel = document.createElement('p');
      if (type === 'sec' || (txt.length < 40 && SUBHEADS.test(txt))){
        pel.className = 'subhead';
        pel.textContent = txt.replace(/:$/, '');
      } else if (txt.startsWith('•')){
        pel.className = 'bullet';
        txt = txt.replace(/^•\s*/, '');
        pel.appendChild(conTextoConNotas(txt));
      } else {
        if (!seenProto) pel.className = 'intro-p';
        pel.appendChild(conTextoConNotas(txt));
      }
      body.appendChild(pel);
    }

    /* [^N] → superíndice; al tocarlo se abre la nota en un panel
       sin mover la lectura (ver notaPanel más abajo). */
    var refsVistas = {};
    function conTextoConNotas(txt){
      var frag = document.createDocumentFragment();
      var partes = txt.split(/(\[\^\d+\])/);
      partes.forEach(function(parte){
        var m = parte.match(/^\[\^(\d+)\]$/);
        if (m){
          var sup = document.createElement('sup');
          sup.className = 'nota-ref';
          var a = document.createElement('a');
          a.href = '#nota-' + m[1];
          a.dataset.nota = m[1];
          a.setAttribute('aria-haspopup', 'dialog');
          a.setAttribute('aria-label', (lang === 'es' ? 'Nota ' : 'Note ') + m[1]);
          if (!refsVistas[m[1]]){ a.id = 'ref-' + m[1]; refsVistas[m[1]] = true; }
          a.textContent = m[1];
          sup.appendChild(a);
          frag.appendChild(sup);
        } else if (parte){
          frag.appendChild(document.createTextNode(parte));
        }
      });
      return frag;
    }

    function agregarNotas(notas, lang){
      if (!notas || !notas.length) return;
      var es = lang === 'es';
      var det = document.createElement('details');
      det.className = 'notas-bloque';
      det.id = 'notas';
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="nb-t">' + (es ? 'Notas y referencias' : 'Notes and references') + '</span>' +
        '<span class="nb-n">' + notas.length + '</span>';
      det.appendChild(sum);
      var ol = document.createElement('ol');
      ol.className = 'notas-lista';
      notas.forEach(function(n){
        var li = document.createElement('li');
        li.id = 'nota-' + n.n;
        li.className = 'nota-item';
        li.innerHTML = '<span class="ni-n">' + n.n + '</span><span class="ni-t">' + linkificar(n.texto) + '</span>' +
          (document.getElementById('ref-' + n.n)
            ? '<a class="ni-back" href="#ref-' + n.n + '" aria-label="' + (es ? 'Volver al texto' : 'Back to text') + '">↩</a>'
            : '');
        ol.appendChild(li);
      });
      det.appendChild(ol);
      body.appendChild(det);
    }

    function addHeading(title, label, isChapterTitle){
      var id = 'sec-' + (headings.length + 1);
      headings.push({id: id, title: title, isChapterTitle: isChapterTitle});
      var el = document.createElement('h2');
      el.className = 'h proto-head';
      el.id = id;
      if (isChapterTitle) el.classList.add('chapter-title');
      else seenProto = true;
      if (label){
        var k = document.createElement('span');
        k.className = 'ph-label';
        k.textContent = label;
        el.appendChild(k);
      }
      el.appendChild(document.createTextNode(title));
      body.appendChild(el);
    }

    data.paragraphs.forEach(function(p){
      if (p.type === 'h'){
        addHeading(p.text, '', /^Cap[ií]tulo \d|^Chapter \d/i.test(p.text));
      } else if (p.type === 'h2'){
        var hp = splitProtoHeading(p.text);
        addHeading(hp.title, hp.label, false);
        // cuerpo pegado al título: "QUÉ NO HACER: • … • …"
        var b = hp.body;
        var lead = b.match(/^((?:QUÉ (?:NO )?HACER|CÓMO FUNCIONA|WHAT (?:NOT )?TO DO|HOW IT WORKS):?)\s*/);
        if (lead){ addPara(lead[1], 'sec'); b = b.slice(lead[0].length); }
        b.split(/\s+(?=•\s)/).forEach(function(piece){ addPara(piece); });
      } else {
        addPara(p.text, p.type);
      }
    });
    agregarNotas(data.notas, lang);
    notaPanel.setNotas(data.notas, lang);
    buildTocDrawer(buildReaderToc(headings, lang));
    document.title = (meta ? meta.titulo : data.title) + ' · Lector · Protocolos';
    var target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && target.closest('details')) target.closest('details').open = true;
    if (target) target.scrollIntoView({block: 'start'});
    else window.scrollTo(0,0);
  }).catch(function(){
    wrap.hidden = false;
    wrap.innerHTML = '<div class="reader-empty">El texto de este capítulo aún no está disponible.</div>';
  });
}

/* ---------- arranque ---------- */
document.addEventListener('DOMContentLoaded', function(){
  loadData(function(data){
    DATA = data;
    renderGrid();
    renderReaderToc();
    var params = new URLSearchParams(location.search);
    var cap = params.get('cap');
    if (cap && $('chapterView')) renderChapter(cap);
    if (cap && $('readerContent')) loadChapterText(cap, reader.lang);
  });
  readerInit();

  if ($('player')){
    $('playPause').addEventListener('click', togglePlay);
    $('pmPlay').addEventListener('click', function(e){ e.stopPropagation(); togglePlay(); });
    $('nextBtn').addEventListener('click', nextTrack);
    $('prevBtn').addEventListener('click', prevTrack);
    $('speedBtn').addEventListener('click', function(){
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      var rate = SPEEDS[speedIdx];
      ensureAudio().playbackRate = rate;
      $('speedLabel').textContent = rate + '×';
    });
    // mini-player: tocar la info expande
    $('pmExpand').addEventListener('click', function(e){
      e.stopPropagation();
      $('player').classList.add('expanded');
    });
    $('collapseBtn').addEventListener('click', function(){
      $('player').classList.remove('expanded');
    });
    // barra de progreso arrastrable (pointer events)
    var bar = $('progressBar');
    var dragging = false;
    function seekFromX(clientX){
      var a = ensureAudio();
      if (!isFinite(a.duration) || a.duration <= 0) return;
      var rect = bar.getBoundingClientRect();
      var x = clientX - rect.left;
      a.currentTime = Math.max(0, Math.min(1, x / rect.width)) * a.duration;
    }
    bar.addEventListener('pointerdown', function(e){
      dragging = true;
      try { bar.setPointerCapture(e.pointerId); } catch(err){}
      seekFromX(e.clientX);
    });
    bar.addEventListener('pointermove', function(e){ if (dragging) seekFromX(e.clientX); });
    bar.addEventListener('pointerup', function(){ dragging = false; });
    bar.addEventListener('pointercancel', function(){ dragging = false; });
    bar.addEventListener('keydown', function(e){
      var a = ensureAudio();
      if (e.key === 'ArrowRight') a.currentTime += 10;
      if (e.key === 'ArrowLeft') a.currentTime -= 10;
    });
    $('toggleTranscript').addEventListener('click', function(){
      var panel = $('transcriptPanel');
      var open = panel.classList.toggle('open');
      this.setAttribute('aria-expanded', open);
    });
    var a = $('audio');
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', nextTrack);
    a.addEventListener('play', function(){ setPlayingUI(true); });
    a.addEventListener('pause', function(){ setPlayingUI(false); });
  }
});
})();
