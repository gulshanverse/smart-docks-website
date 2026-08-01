// Utilities
const qs = (sel, el=document)=>el.querySelector(sel);
const qsa = (sel, el=document)=>[...el.querySelectorAll(sel)];

// Page loading transition
window.addEventListener('load',()=>{
  document.body.classList.remove('is-loading');
});

// Typing effect
(function typingEffect(){
  const el = qs('#typing');
  if(!el) return;
  const text = 'Innovative IT Mind | Future-Ready Developer';
  let i = 0; let dir = 1;
  const speed = 55; const pause = 1200;
  function type(){
    if(dir === 1){
      el.textContent = text.slice(0, i++);
      if(i<=text.length){ setTimeout(type, speed); }
      else { dir = -1; setTimeout(type, pause); }
    } else {
      el.textContent = text.slice(0, i--);
      if(i>=0){ setTimeout(type, 24); }
      else { dir = 1; setTimeout(type, 420); }
    }
  }
  type();
})();

// Live 3D Clock (analog hands + digital)
(function liveClock(){
  const h = qs('#hourHand');
  const m = qs('#minuteHand');
  const s = qs('#secondHand');
  const digital = qs('#digitalClock');
  function pad(n){return String(n).padStart(2,'0');}
  function update(){
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();
    const hDeg = (hh % 12) * 30 + mm * 0.5;
    const mDeg = mm * 6;
    const sDeg = ss * 6;
    if(h) h.style.transform = `translate(-50%, 0) rotate(${hDeg}deg)`;
    if(m) m.style.transform = `translate(-50%, 0) rotate(${mDeg}deg)`;
    if(s) s.style.transform = `translate(-50%, 0) rotate(${sDeg}deg)`;
    if(digital) digital.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }
  update();
  setInterval(update, 1000);
})();

// 3D Particle Background (lightweight starfield)
(function starfield(){
  const canvas = qs('#bg3d');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = canvas.offsetWidth;
  let height = canvas.height = canvas.offsetHeight;
  let deviceRatio = window.devicePixelRatio || 1;
  function resize(){
    width = canvas.offsetWidth; height = canvas.offsetHeight;
    canvas.width = Math.floor(width * deviceRatio);
    canvas.height = Math.floor(height * deviceRatio);
    ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  const depth = 800; // z-depth for perspective
  const count = Math.round((width*height)/18000) + 90; // adaptive
  const stars = new Array(count).fill(0).map(()=>({
    x:(Math.random()*2-1)*width,
    y:(Math.random()*2-1)*height,
    z:Math.random()*depth
  }));
  let mouseX=0, mouseY=0, targetX=0, targetY=0;
  window.addEventListener('mousemove', e=>{
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left - rect.width/2)/rect.width;
    mouseY = (e.clientY - rect.top - rect.height/2)/rect.height;
  }, {passive:true});

  function step(){
    targetX += (mouseX - targetX)*0.06;
    targetY += (mouseY - targetY)*0.06;
    ctx.clearRect(0,0,width,height);
    ctx.save();
    ctx.translate(width/2, height/2);
    for(const p of stars){
      p.z -= 1.2; if(p.z<=1){ p.z = depth; }
      const scale = 200 / p.z;
      const x = p.x*scale + targetX*60;
      const y = p.y*scale + targetY*60;
      const alpha = Math.max(0, 1 - p.z/depth);
      ctx.fillStyle = `rgba(140, 245, 255, ${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, 1.6*alpha), 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(step);
  }
  step();
})();

// Intersection Reveal + progress animation
(function revealObserver(){
  const items = qsa('.reveal');
  const progress = qsa('.progress');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        // Progress bars when visible
        if(entry.target.classList.contains('section')){
          progress.forEach(p=>{
            if(p.closest('.section').id === entry.target.id){
              const level = Number(p.getAttribute('data-level')) || 0;
              const bar = qs('.progress-bar', p);
              if(bar){
                requestAnimationFrame(()=>{ bar.style.width = level + '%'; });
              }
            }
          });
        }
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(el=>io.observe(el));
})();

// Tilt effect on hover
(function tilt(){
  const tiltEls = qsa('[data-tilt]');
  tiltEls.forEach(el=>{
    let req = null;
    let px=0, py=0;
    function onMove(e){
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left)/rect.width; // 0..1
      const y = (e.clientY - rect.top)/rect.height; // 0..1
      px = (x - 0.5) * 10; // degrees
      py = (y - 0.5) * -10;
      if(!req){ req = requestAnimationFrame(apply); }
    }
    function apply(){
      el.style.transform = `perspective(700px) rotateX(${py}deg) rotateY(${px}deg)`;
      req = null;
    }
    function reset(){ el.style.transform = 'perspective(700px) rotateX(0) rotateY(0)'; }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
  });
})();

// Parallax on elements with data-speed
(function parallax(){
  const items = qsa('[data-speed]');
  function onScroll(){
    const y = window.scrollY;
    items.forEach(el=>{
      const speed = Number(el.getAttribute('data-speed')) || 0.1;
      const translate = y * speed;
      el.style.transform = `translate3d(0, ${translate}px, 0)`;
    });
  }
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});
})();

// Projects modal
(function projectsModal(){
  const modal = qs('#projectModal');
  const closeBtn = qs('#modalClose');
  const title = qs('#modalTitle');
  const desc = qs('#modalDesc');
  const link = qs('#modalLink');
  function open(data){
    title.textContent = data.title || 'Project';
    desc.textContent = data.desc || '';
    link.href = data.link || '#';
    modal.classList.remove('hidden');
  }
  function close(){ modal.classList.add('hidden'); }
  qsa('.project-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      open({
        title: card.getAttribute('data-title'),
        desc: card.getAttribute('data-desc'),
        link: card.getAttribute('data-link')
      });
    });
  });
  modal.addEventListener('click', (e)=>{ if(e.target === modal) close(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
})();

// Contact form (demo)
(function contactForm(){
  const form = qs('#contactForm');
  if(!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = qs('#name').value.trim();
    const email = qs('#email').value.trim();
    const msg = qs('#message').value.trim();
    const whatsappUrl = `https://wa.me/919999999999?text=${encodeURIComponent(`Hi, I'm ${name}. ${msg} (Email: ${email})`)}`;
    window.open(whatsappUrl, '_blank');
  });
})();

// Footer year
(function year(){ const y = qs('#year'); if(y) y.textContent = new Date().getFullYear(); })();