(() => {
  const $ = (sel) => document.querySelector(sel);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('cubezen.' + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('cubezen.' + key, JSON.stringify(value)); } catch {}
    },
  };

  // ---------- player & mixer ----------
  const playBtn = $('#btn-play');
  function togglePlay() {
    const playing = Ambience.toggle();
    playBtn.classList.toggle('playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }
  playBtn.addEventListener('click', togglePlay);
  Ambience.onPiece((name) => { $('#track').textContent = `${name} · generative`; });

  const prefs = store.get('prefs', { music: 0.6, rain: 0, fire: 0.35 });
  for (const kind of ['music', 'rain', 'fire']) {
    const el = $('#vol-' + kind);
    const apply = () => {
      const v = Number(el.value);
      prefs[kind] = v;
      el.style.setProperty('--fill', v * 100 + '%');
      Ambience.setVolume(kind, v);
      if (kind === 'rain') Scene.setRain(v);
    };
    el.value = prefs[kind];
    apply();
    el.addEventListener('input', () => { Ambience.init(); apply(); store.set('prefs', prefs); });
  }

  // ---------- pomodoro ----------
  const DURATION = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const today = new Date().toDateString();
  let stats = store.get('stats', { day: today, count: 0 });
  if (stats.day !== today) stats = { day: today, count: 0 };

  let mode = 'focus', remaining = DURATION.focus, endAt = 0, running = false, timer = null;

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function renderPomodoro() {
    $('#pomo-time').textContent = fmt(remaining);
    $('#pomo-start').textContent = running ? 'Pause' : 'Start';
    document.title = running ? `${fmt(remaining)} · ${LABEL[mode]} — Cubezen` : 'Cubezen — cozy blocky lofi';
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    const inCycle = stats.count % 4 || (stats.count ? 4 : 0);
    $('#pomo-blocks').innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < inCycle ? 'on' : ''}"></span>`).join('');
    $('#pomo-count').textContent = `${stats.count} focus session${stats.count === 1 ? '' : 's'} today`;
  }

  function stop() { running = false; clearInterval(timer); renderPomodoro(); }

  function setMode(m) { stop(); mode = m; remaining = DURATION[m]; renderPomodoro(); }

  function start() {
    Ambience.init();
    running = true;
    endAt = Date.now() + remaining * 1000;
    timer = setInterval(update, 250);
    renderPomodoro();
  }

  function update() {
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remaining > 0) return renderPomodoro();
    Ambience.chime();
    if (mode === 'focus') {
      stats.count++;
      store.set('stats', stats);
      setMode(stats.count % 4 === 0 ? 'long' : 'short');
    } else {
      setMode('focus');
    }
  }

  $('#pomo-start').addEventListener('click', () => (running ? stop() : start()));
  $('#pomo-reset').addEventListener('click', () => setMode(mode));
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
  renderPomodoro();

  // ---------- tasks ----------
  let tasks = store.get('tasks', []);
  const list = $('#task-list');

  function saveTasks() { store.set('tasks', tasks); renderTasks(); }

  function renderTasks() {
    list.innerHTML = '';
    if (!tasks.length) {
      list.innerHTML = '<li class="empty">Nothing yet. Add something cozy.</li>';
      return;
    }
    for (const task of tasks) {
      const li = document.createElement('li');
      li.classList.toggle('done', task.done);
      const check = document.createElement('button');
      check.className = 'check';
      check.setAttribute('aria-label', task.done ? 'Mark as not done' : 'Mark as done');
      check.addEventListener('click', () => { task.done = !task.done; saveTasks(); });
      const text = document.createElement('span');
      text.textContent = task.text;
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Delete task');
      del.addEventListener('click', () => { tasks = tasks.filter((t) => t !== task); saveTasks(); });
      li.append(check, text, del);
      list.append(li);
    }
  }

  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#task-input');
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now(), text, done: false });
    input.value = '';
    saveTasks();
  });
  renderTasks();

  // ---------- zen, fullscreen, shortcuts ----------
  const toggleZen = () => document.body.classList.toggle('zen');
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };
  $('#btn-zen').addEventListener('click', toggleZen);
  $('#btn-fs').addEventListener('click', toggleFullscreen);

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'h' || e.key === 'H') toggleZen();
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
})();
