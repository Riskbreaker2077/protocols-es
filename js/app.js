/* Protocolos (proyecto no oficial) — lógica del sitio, reproductor y lector.
   Sin checks de red en runtime: la disponibilidad de PDFs, pistas y duraciones
   viene precomputada en js/data.json. */
(function(){
'use strict';

var DATA = null;
var state = { chapter: null, trackIndex: -1, transcript: [], currentPara: -1 };
var CH_ART = {
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
      '<span class="chip">' + ICO.play + 'Escuchar</span>' +
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
  $('chNum').textContent = 'Capítulo ' + (idx+1);
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
      b.innerHTML = '<span class="flag">' + dir.toUpperCase() + '</span> PDF · ' + name;
    } else {
      b.classList.add('unavailable');
      b.innerHTML = '<span class="flag">' + dir.toUpperCase() + '</span> PDF · ' + name + ' <small>(próximamente)</small>';
    }
    row.appendChild(b);
  });

  // Playlist de pistas.
  var list = $('trackList');
  list.innerHTML = '';
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
        pel.textContent = txt.replace(/^•\s*/, '');
      } else {
        if (!seenProto) pel.className = 'intro-p';
        pel.textContent = txt;
      }
      body.appendChild(pel);
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
    buildTocDrawer(buildReaderToc(headings, lang));
    document.title = (meta ? meta.titulo : data.title) + ' · Lector · Protocolos';
    var target = location.hash && document.getElementById(location.hash.slice(1));
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
