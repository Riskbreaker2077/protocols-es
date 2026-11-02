/* Protocolos (proyecto no oficial) — lógica del sitio y del reproductor. */
(function(){
'use strict';

var DATA = null;
var state = { chapter: null, trackIndex: -1, transcript: [], currentPara: -1 };

function $(id){ return document.getElementById(id); }
function fmt(s){
  if (!isFinite(s) || s < 0) s = 0;
  var m = Math.floor(s/60), r = Math.floor(s%60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/* ---------- datos ---------- */
function loadData(cb){
  fetch('js/data.json').then(function(r){ return r.json(); }).then(cb)
    .catch(function(){ cb({chapters: []}); });
}

/* ---------- tarjetas de capítulos ---------- */
function chapterCard(ch, i){
  var n = ch.tracks.filter(function(t){ return t.available; }).length;
  var a = document.createElement('a');
  a.className = 'chapter-card';
  a.href = 'biblioteca.html?cap=' + encodeURIComponent(ch.slug);
  a.innerHTML =
    '<span class="num">Capítulo ' + (i+1) + '</span>' +
    '<h3>' + ch.titulo + '</h3>' +
    '<p>' + ch.desc + '</p>' +
    '<span class="meta">' + (ch.tracks.length - 1) + ' protocolos · ' + n + '/' + ch.tracks.length + ' pistas de audio</span>' +
    '<span class="open">Abrir capítulo →</span>';
  return a;
}
function renderGrid(){
  var grid = $('chaptersGrid');
  if (!grid || !DATA) return;
  grid.innerHTML = '';
  DATA.chapters.forEach(function(ch, i){ grid.appendChild(chapterCard(ch, i)); });
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
      '<span><span class="t-title">' + t.titulo + '</span><br>' +
      '<span class="t-sub">' + (t.available ? 'Pista de audio disponible' : 'En producción') + '</span></span>' +
      (t.available ? '' : '<span class="soon-tag">Próximamente</span>');
    if (t.available){
      el.addEventListener('click', function(){ playTrack(i); });
    }
    list.appendChild(el);
  });
  return true;
}

/* ---------- reproductor ---------- */
var audio = null;
function ensureAudio(){ if (!audio) audio = $('audio'); return audio; }

function playTrack(i){
  var t = state.chapter.tracks[i];
  state.trackIndex = i;
  var a = ensureAudio();
  a.src = t.audio;
  a.playbackRate = parseFloat($('speedSelect').value) || 1;
  a.play().then(function(){
    $('playPause').textContent = '⏸';
  }).catch(function(){});
  $('playerTitle').innerHTML = t.titulo + '<span class="chap">' + state.chapter.titulo + '</span>';
  $('downloadBtn').href = t.audio;
  $('downloadBtn').setAttribute('download', t.id + '.mp3');
  $('player').classList.add('open');
  document.body.classList.add('has-player');
  document.querySelectorAll('.track').forEach(function(el, j){
    el.classList.toggle('active', j === i);
  });
  if ($('transcriptPanel').classList.contains('open') || true) loadTranscript(t);
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
  if (!isFinite(a.duration)) return;
  var pct = (a.currentTime / a.duration) * 100;
  $('progressFill').style.width = pct + '%';
  $('progressBar').setAttribute('aria-valuenow', pct.toFixed(1));
  $('timeLabel').textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration);
  // resaltar párrafo actual
  var cur = -1;
  for (var i = 0; i < state.transcript.length; i++){
    if (state.transcript[i].sec <= a.currentTime) cur = i; else break;
  }
  if (cur !== state.currentPara){
    state.transcript.forEach(function(item, j){ item.el.classList.toggle('current', j === cur); });
    state.currentPara = cur;
    if (cur >= 0) state.transcript[cur].el.scrollIntoView({block:'nearest', behavior:'smooth'});
  }
}

/* ---------- arranque ---------- */
document.addEventListener('DOMContentLoaded', function(){
  loadData(function(data){
    DATA = data;
    renderGrid();
    var params = new URLSearchParams(location.search);
    var cap = params.get('cap');
    if (cap && $('chapterView')) renderChapter(cap);
  });

  if ($('player')){
    $('playPause').addEventListener('click', togglePlay);
    $('nextBtn').addEventListener('click', nextTrack);
    $('speedSelect').addEventListener('change', function(){
      ensureAudio().playbackRate = parseFloat(this.value) || 1;
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
    bar.addEventListener('touchstart', seekFromEvent);
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
    a.addEventListener('play', function(){ $('playPause').textContent = '⏸'; });
    a.addEventListener('pause', function(){ $('playPause').textContent = '▶'; });
  }
});
})();
