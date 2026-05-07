// ── Render nav ───────────────────────────────────────────────
function renderNav() {
  document.querySelector(".nav-logo").innerHTML =
    `<span class="nav-logo-first">${PORTFOLIO.name}</span>&nbsp;<span class="nav-logo-last">${PORTFOLIO.lastName}</span>`;
  document.querySelector(".nav-links").innerHTML = ["about", "projects"]
    .map(id => `<a href="#${id}">${id}</a>`).join("");
}

// ── Render hero ──────────────────────────────────────────────
function renderHero() {
  const lines = PORTFOLIO.tagline.split("\n").map(l => l.trim()).filter(Boolean);
  document.querySelector(".hero-headline").innerHTML = lines.map((line, li) => {
    const isLast = li === lines.length - 1;
    return line.split(" ").map((word, wi_idx) => {
      const inner = isLast ? `<span style="color:#C9A97F">${word}</span>` : word;
      return isLast ? `<span class="hero-word" style="--wi:${wi_idx}">${inner}</span>` : word;
    }).join(" ");
  }).join("<br/>");

  const heroLinks = PORTFOLIO.links.filter(l => l.label.toLowerCase() !== "email");
  document.querySelector(".hero-links").innerHTML = heroLinks.map(l =>
    `<a href="${l.href}" class="btn" target="_blank" rel="noopener">${l.label}</a>`
  ).join("");
}


// ── Render about ─────────────────────────────────────────────
function renderAbout() {
  document.querySelector(".about-text").innerHTML =
    PORTFOLIO.about.split("\n").filter(Boolean).map(p => `<p>${p.trim()}</p>`).join("");
}

// ── Render projects ──────────────────────────────────────────
function renderProjects(projectsData) {
  const projects = projectsData || window._projects || PORTFOLIO.projects;
  const grid = document.querySelector(".projects-grid");
  grid.innerHTML = projects.map((p, i) =>
    `<article class="project-card fade-in" data-index="${i}">
      <button class="project-expand-btn" aria-label="View details">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M10 5 L14 1 M14 1 L10 1 M14 1 L14 5"/>
          <path d="M6 11 L2 15 M2 15 L6 15 M2 15 L2 11"/>
        </svg>
      </button>
      ${p.image ? `<img src="${p.image}" alt="${p.title}" class="project-image"/>` : `<div class="project-image placeholder"></div>`}
      <h3 class="project-title">${p.title}</h3>
      <p class="project-summary">${p.summary}</p>
    </article>`
  ).join("");

}

// ── Lightbox ─────────────────────────────────────────────────
function initLightbox() {
  const lb       = document.getElementById("lightbox");
  const lbImg    = document.getElementById("lightbox-img");
  const lbClose  = document.getElementById("lightbox-close");

  function openLightbox(src) {
    lbImg.src = src;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    lbImg.src = "";
    // restore body scroll only if project modal is also closed
    if (!document.getElementById("project-modal").classList.contains("open")) {
      document.body.style.overflow = "";
    }
  }

  lbClose.addEventListener("click", closeLightbox);
  lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && lb.classList.contains("open")) closeLightbox(); });

  // Global delegation — any .img-expand-btn anywhere on the page
  document.addEventListener("click", e => {
    const btn = e.target.closest(".img-expand-btn");
    if (!btn) return;
    e.stopPropagation();
    const img = btn.closest(".img-expand-wrap")?.querySelector("img");
    if (img) openLightbox(img.src);
  });
}

// ── Project modal ────────────────────────────────────────────
function initModal() {
  const modal    = document.getElementById("project-modal");
  const backdrop = modal.querySelector(".modal-backdrop");
  const closeBtn = modal.querySelector(".modal-close");

  function openModal(p, index) {
    modal.querySelector(".modal-title").textContent   = p.title;
    modal.querySelector(".modal-summary").textContent = p.summary;

    // Render blocks
    const detailsEl = modal.querySelector(".modal-details");
    if (p.blocks && p.blocks.length > 0) {
      detailsEl.innerHTML = p.blocks.map(block => {
        if (block.type === 'heading') return `<h3 class="modal-block-heading">${block.content}</h3>`;
        const expandBtn = `<button class="img-expand-btn" aria-label="Expand image"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 4.5V1h3.5M7.5 1H11v3.5M11 7.5V11H7.5M4.5 11H1V7.5"/></svg></button>`;
        if (block.type === 'image') {
          const align = block.align || 'left';
          const wrapStyle = align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin-left:auto;' : '';
          return `<span class="img-expand-wrap" style="width:${block.size||'100%'};${wrapStyle}">
            <img src="${block.content}" alt="" class="modal-block-image" style="width:100%" />
            ${expandBtn}
          </span>`;
        }
        if (block.type === 'image-row') {
          const imgs = (block.images || []).filter(img => img.url);
          return `<div class="modal-image-row">${imgs.map(img =>
            `<span class="img-expand-wrap" style="flex:1;min-width:0">
              <img src="${img.url}" alt="" class="modal-image-row-item" style="width:100%" />
              ${expandBtn}
            </span>`
          ).join('')}</div>`;
        }
        if (block.type === 'image-text') {
          const dir = block.imagePosition === 'right' ? 'row-reverse' : 'row';
          const imgW = block.imageWidth || '40%';
          return `<div class="modal-image-text" style="flex-direction:${dir}">
            ${block.image ? `<span class="img-expand-wrap" style="width:${imgW};flex-shrink:0">
              <img src="${block.image}" class="modal-image-text-img" style="width:100%" />
              ${expandBtn}
            </span>` : ''}
            <div class="modal-block-text modal-image-text-body">${block.content || ''}</div>
          </div>`;
        }
        return `<div class="modal-block-text">${block.content}</div>`;
      }).join('');
      detailsEl.style.display = "block";
    } else {
      detailsEl.innerHTML = "";
      detailsEl.style.display = "none";
    }

    modal.querySelector(".modal-tags").innerHTML = p.tags
      .map(t => `<span class="project-tag">${t}</span>`).join("");

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  // Event delegation on the grid — works even after CMS re-renders the cards
  const grid = document.querySelector(".projects-grid");
  if (grid) {
    grid.addEventListener("click", e => {
      const card = e.target.closest(".project-card");
      if (!card) return;
      const index = parseInt(card.dataset.index);
      const projects = window._projects || PORTFOLIO.projects;
      if (!isNaN(index) && projects[index]) openModal(projects[index], index);
    });
  }
}

// ── Render footer ────────────────────────────────────────────
function renderFooter() {
  document.querySelector(".footer-copy").textContent =
    `© ${new Date().getFullYear()} ${PORTFOLIO.name}`;
}

// ── Scroll-based effects ─────────────────────────────────────
function initScrollEffects() {
  const nav = document.getElementById("nav");
  const hero = document.getElementById("hero");
  window.addEventListener("scroll", () => {
    const heroBottom = hero ? hero.offsetHeight : 0;
    nav.classList.toggle("scrolled", window.scrollY >= heroBottom - nav.offsetHeight);
  }, { passive: true });

  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));
}

// ── Intro animation ──────────────────────────────────────────
function runIntro() {
  const intro = document.getElementById("intro");
  if (!intro) return;

  document.body.classList.add("intro-active");

  setTimeout(() => {
    intro.style.transition = "transform 0.8s cubic-bezier(0.76, 0, 0.24, 1)";
    intro.style.transform  = "translateY(-100%)";

    setTimeout(() => {
      intro.remove();
      document.body.classList.remove("intro-active");
      document.body.classList.add("intro-done");
    }, 900);
  }, 2500);
}

// ── Hero mouse parallax ──────────────────────────────────────
function initParallax() {
  const hero = document.getElementById("hero");
  if (!hero) return;
  window.addEventListener("mousemove", e => {
    const x = (e.clientX / window.innerWidth  - 0.5) * -18;
    const y = (e.clientY / window.innerHeight - 0.5) * -12;
    hero.style.setProperty("--px", x + "px");
    hero.style.setProperty("--py", y + "px");
  }, { passive: true });
}

// ── Custom cursor ────────────────────────────────────────────
function initCursor() {
  const dot  = document.getElementById("cursor-dot");
  const ring = document.getElementById("cursor-ring");
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0, prevRx = 0, prevRy = 0;
  let hovering = false;

  window.addEventListener("mousemove", e => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + "px";
    dot.style.top  = my + "px";
  }, { passive: true });

  (function loop() {
    rx += (mx - rx) * 0.1;
    ry += (my - ry) * 0.1;

    const vx    = rx - prevRx;
    const vy    = ry - prevRy;
    prevRx = rx; prevRy = ry;

    const speed   = Math.sqrt(vx * vx + vy * vy);
    const angle   = Math.atan2(vy, vx) * (180 / Math.PI);
    const base    = hovering ? 1.65 : 1;
    const stretch = Math.min(base + speed * 0.13, base * 1.45);
    const squish  = base / stretch;

    ring.style.transform =
      `translate(${rx - 15}px, ${ry - 15}px) rotate(${angle}deg) scaleX(${stretch}) scaleY(${squish})`;

    requestAnimationFrame(loop);
  })();

  document.querySelectorAll("a, button").forEach(el => {
    el.addEventListener("mouseenter", () => {
      hovering = true;
      dot.style.opacity = "0";
      ring.style.borderColor = "rgba(255,255,255,0.85)";
    });
    el.addEventListener("mouseleave", () => {
      hovering = false;
      dot.style.opacity = "1";
      ring.style.borderColor = "rgba(255,255,255,0.55)";
    });
  });
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  renderHero();
  renderAbout();
  renderProjects();
  renderFooter();
  initScrollEffects();
  initParallax();
  initCursor();
  initModal();
  initLightbox();
  if (window.initCMS) window.initCMS();
  runIntro();
});
