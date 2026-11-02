/* Protocolos (proyecto no oficial) — lógica del sitio, reproductor y lector. */
(function(){
'use strict';

var DATA = null;
var state = { chapter: null, trackIndex: -1, transcript: [], currentPara: -1 };
var CH_ART = {
  '01_dormir':'assets/img/c1_dormir.svg',
  '02_ejercicio':'assets/img/c2_ejercicio.svg',
  '03_control_del_estres':'assets/img/c3_estres.svg',
  '04_nutricion':'assets/img/c4_nutricion.svg',
  '05_luz':'assets/img/c5_luz.svg',
  '06_enfoque':'assets/img/c6_enfoque.svg',
  '07_crecimiento_personal':'assets/img/c7_crecimiento.svg'
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

/* ---------- tarjetas de capítulos ---------- */
function chapterCard(ch, i){
  var n = ch.tracks.filter(function(t){ return t.available; }).length;
  var a = document.createElement('a');
  a.className = 'chapter-card fade-in';
  a.href = 'biblioteca.html?cap=' + encodeURIComponent(ch.slug);
  a.style.animationDelay = (i * 0.05) + 's';
  a.innerHTML =
    '<span class="art"><img src="' + (CH_ART[ch.slug] || 'assets/img/hero.svg') + '" alt="" loading="lazy"></span>' +
    '<span class="body">' +
    '<span class="num">Capítulo ' + (i+1) + '</span>' +
    '<h3>' + esc(ch.titulo) + '</h3>' +
    '<p>' + esc(ch.desc) + '</p>' +
    '<span class="meta">' + (ch.tracks.length - 1) + ' protocolos · ' + n + '/' + ch.tracks.length + ' pistas de audio</span>' +
    '<span class="card-actions">' +
      '<span class="chip">▶ Escuchar</span>' +
      '<span class="chip alt" data-reader="' + esc(ch.slug) + '">📖 Leer</span>' +
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

/* ---------- vista de capítulo ---------- */
function renderChapter(slug){
  var idx = DATA.chapters.findIndex(function(c){ return c.slug === slug; });
  if (idx < 0) return false;
  var ch = DATA.chapters[idx];
  state.chapter = ch;
  $('libraryView').hidden = true;
  $('libraryHead').hidden = true;
  $('chapterView').hidden = false;
  document.title = ch.titulo + ' · Protocolos (proyecto no oficial)';
  $('chNum').textContent = 'Capítulo ' + (idx+1);
  $('chTitle').textContent = ch.titulo;
  $('chEn').textContent = ch.en;
  $('chDesc').textContent = ch.desc;
  var art = $('chArt');
  if (art){ art.src = CH_ART[ch.slug] || 'assets/img/hero.svg'; art.alt = ''; }
  var readBtn = $('readOnlineBtn');
  if (readBtn) readBtn.href = 'lector.html?cap=' + encodeURIComponent(slug) + '&lang=es';

  // PDFs: se generan en paralelo; estado de carga / próximo si faltan.
  var row = $('pdfRow');
  row.innerHTML = '';
  [['ES','es','Español'],['EN','en','English']].forEach(function(p){
    var code = p[0], dir = p[1], name = p[2];
    var b = document.createElement('a');
    b.className = 'pdf-btn';
    b.rel = 'noopener';
    b.innerHTML = '<span class="flag">' + code + '</span> PDF · ' + name;
    var url = 'assets/pdf/' + dir + '/' + ch.slug + '.pdf';
    fetch(url, {method:'HEAD'}).then(function(r){
      if (r.ok){ b.href = url; b.setAttribute('download',''); }
      else { b.classList.add('unavailable'); b.innerHTML += ' <small>(próximamente)</small>'; b.removeAttribute('href'); }
    }).catch(function(){
      b.classList.add('unavailable'); b.innerHTML += ' <small>(próximamente)</small>'; b.removeAttribute('href');
    });
    row.appendChild(b);
  });

  // Lista de pistas.
  var list = $('trackList');
  list.innerHTML = '';
  ch.tracks.forEach(function(t, i){
    var el = document.createElement(t.available ? 'button' : 'div');
    el.className = 'track' + (t.available ? '' : ' soon');
    el.innerHTML =
      '<span class="icon">' + (t.available ? '▶' : '·') + '</span>' +
      '<span><span class="t-title">' + esc(t.titulo) + '</span><br>' +
      '<span class="t-sub">' + (t.available ? 'Pista de audio disponible' : 'En producción') + '</span></span>' +
      (t.available ? '' : '<span class="soon-tag">Próximamente</span>');
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

function setMiniProgress(pct){
  var bar = document.querySelector('#pmProgress i');
  if (bar) bar.style.width = pct + '%';
}

function playTrack(i){
  var t = state.chapter.tracks[i];
  state.trackIndex = i;
  var a = ensureAudio();
  a.src = t.audio;
  a.playbackRate = parseFloat($('speedSelect').value) || 1;
  a.play().then(function(){
    $('playPause').textContent = '⏸';
  }).catch(function(){});
  $('playerTitle').innerHTML = esc(t.titulo) + '<span class="chap">' + esc(state.chapter.titulo) + '</span>';
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
  if (a.paused){ a.play(); $('playPause').textContent = '⏸'; }
  else { a.pause(); $('playPause').textContent = '▶'; }
}

function nextTrack(){
  if (!state.chapter) return;
  for (var j = state.trackIndex + 1; j < state.chapter.tracks.length; j++){
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
  if (a.paused){ a.play(); $('playPause').textContent = '⏸'; }
}

function onTimeUpdate(){
  var a = ensureAudio();
  if (!isFinite(a.duration) || a.duration <= 0) return;
  var pct = (a.currentTime / a.duration) * 100;
  $('progressFill').style.width = pct + '%';
  $('progressBar').setAttribute('aria-valuenow', pct.toFixed(1));
  $('timeLabel').textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration);
  setMiniProgress(pct);
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

  // barra de progreso de lectura
  var rp = $('readerProgress');
  window.addEventListener('scroll', function(){
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    rp.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, {passive:true});

  if (DATA && DATA.chapters.length){ renderReaderToc(); }
  if (reader.slug){ loadChapterText(reader.slug, reader.lang); }
  else if ($('readerLoading')) $('readerLoading').hidden = true;
}

function applyReaderFs(){
  document.documentElement.style.setProperty('--reader-fs', reader.fs + 'rem');
  localStorage.setItem('readerFs', String(reader.fs));
}

function loadChapterText(slug, lang){
  var wrap = $('readerContent');
  var loading = $('readerLoading');
  if (loading) loading.hidden = false;
  wrap.hidden = true;
  wrap.innerHTML = '';
  var url = 'assets/texto/' + lang + '/' + slug + '.json';
  fetch(url).then(function(r){ if (!r.ok) throw 0; return r.json(); }).then(function(data){
    if (loading) loading.hidden = true;
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
    data.paragraphs.forEach(function(p){
      var el = document.createElement(p.type === 'h' ? 'h2' : 'p');
      if (p.type === 'h') el.className = 'h';
      el.textContent = p.text;
      body.appendChild(el);
    });
    document.title = (meta ? meta.titulo : data.title) + ' · Lector · Protocolos';
    window.scrollTo(0,0);
  }).catch(function(){
    if (loading) loading.hidden = true;
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
    $('nextBtn').addEventListener('click', nextTrack);
    $('speedSelect').addEventListener('change', function(){
      ensureAudio().playbackRate = parseFloat(this.value) || 1;
    });
    // mini-player: tocar la info expande; botones play/expand
    $('pmPlay').addEventListener('click', function(e){ e.stopPropagation(); togglePlay(); });
    $('pmExpand').addEventListener('click', function(e){
      e.stopPropagation();
      $('player').classList.add('expanded');
    });
    $('collapseBtn').addEventListener('click', function(){
      $('player').classList.remove('expanded');
    });
    var bar = $('progressBar');
    function seekFromEvent(e){
      var a = ensureAudio();
      if (!isFinite(a.duration)) return;
      var rect = bar.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      a.currentTime = Math.max(0, Math.min(1, x / rect.width)) * a.duration;
    }
    bar.addEventListener('click', seekFromEvent);
    bar.addEventListener('touchstart', seekFromEvent, {passive:true});
    bar.addEventListener('keydown', function(e){
      var a = ensureAudio();
      if (e.key === 'ArrowRight') a.currentTime += 10;
      if (e.key === 'ArrowLeft') a.currentTime -= 10;
    });
    $('toggleTranscript').addEventListener('click', function(){
      var panel = $('transcriptPanel');
      var open = panel.classList.toggle('open');
      this.setAttribute('aria-expanded', open);
      this.textContent = open ? 'Ocultar transcripción' : 'Mostrar transcripción';
    });
    var a = $('audio');
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', nextTrack);
    a.addEventListener('play', function(){ $('playPause').textContent = '⏸'; $('pmPlay').textContent = '⏸'; });
    a.addEventListener('pause', function(){ $('playPause').textContent = '▶'; $('pmPlay').textContent = '▶'; });
  }
});
})();
