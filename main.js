// ── Helpers ──────────────────────────────────────────────────
function isVideoUrl(url) {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url || '');
}

// ── Render nav ───────────────────────────────────────────────
function renderNav() {
  document.querySelector(".nav-logo").innerHTML =
    `<span class="nav-logo-first">${PORTFOLIO.name}</span>&nbsp;<span class="nav-logo-last">${PORTFOLIO.lastName}</span>`;
  document.querySelector(".nav-links").innerHTML = ["projects", "about"]
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
  const allProjects = projectsData || window._projects || PORTFOLIO.projects;
  const isAdmin = document.body.classList.contains('admin-mode');
  const projects = isAdmin ? allProjects : allProjects.filter(p => !p.hidden);
  const grid = document.querySelector(".projects-grid");
  grid.innerHTML = projects.map((p, i) => {
    const realIndex = allProjects.indexOf(p);
    return `<article class="project-card fade-in${p.hidden ? ' project-card-hidden' : ''}" data-index="${realIndex}">
      ${p.hidden ? '<span class="project-hidden-badge">Hidden</span>' : ''}`;
      <button class="project-expand-btn" aria-label="View details">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M10 5 L14 1 M14 1 L10 1 M14 1 L14 5"/>
          <path d="M6 11 L2 15 M2 15 L6 15 M2 15 L2 11"/>
        </svg>
      </button>
      ${p.image
        ? isVideoUrl(p.image)
          ? `<video src="${p.image}" class="project-image project-image-video" autoplay muted loop playsinline></video>`
          : `<img src="${p.image}" alt="${p.title}" class="project-image" style="object-position:${p.thumbnailPosition || 'center center'}"/>`
        : `<div class="project-image placeholder"></div>`
      }
      <h3 class="project-title">${p.title}</h3>
      <p class="project-summary">${p.summary}</p>
    </article>`;
  }).join("");

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

  // Global delegation — expand button OR clicking directly on the image
  document.addEventListener("click", e => {
    const btn = e.target.closest(".img-expand-btn");
    if (btn) {
      e.stopPropagation();
      const img = btn.closest(".img-expand-wrap")?.querySelector("img");
      if (img) openLightbox(img.src);
      return;
    }
    const wrap = e.target.closest(".img-expand-wrap");
    if (wrap && e.target.tagName === "IMG") openLightbox(e.target.src);
  });
}

// ── Project modal ────────────────────────────────────────────
function initModal() {
  const modal    = document.getElementById("project-modal");
  const backdrop = modal.querySelector(".modal-backdrop");
  const closeBtn = modal.querySelector(".modal-close");

  function openModal(p, index) {
    // Thumbnail
    const thumbWrap = modal.querySelector(".modal-thumbnail-wrap");
    if (thumbWrap) {
      if (p.image) {
        const pos = p.thumbnailPosition || 'center center';
        if (isVideoUrl(p.image)) {
          thumbWrap.innerHTML = `<video src="${p.image}" class="modal-thumbnail modal-thumbnail-video" autoplay muted loop playsinline></video>`;
        } else {
          const expandBtn = `<button class="img-expand-btn" aria-label="Expand image"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 4.5V1h3.5M7.5 1H11v3.5M11 7.5V11H7.5M4.5 11H1V7.5"/></svg></button>`;
          thumbWrap.innerHTML = `<span class="img-expand-wrap"><img src="${p.image}" alt="${p.title}" class="modal-thumbnail" style="object-position:${pos}" />${expandBtn}</span>`;
        }
        thumbWrap.style.display = "block";
      } else {
        thumbWrap.innerHTML = "";
        thumbWrap.style.display = "none";
      }
    }

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
        if (block.type === 'video') {
          const align = block.align || 'left';
          const wrapStyle = align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin-left:auto;' : '';
          const loopAttr = block.loop !== false ? 'loop' : '';
          return `<div style="width:${block.size||'100%'};${wrapStyle}">
            <video src="${block.content}" class="modal-block-video" autoplay muted playsinline ${loopAttr} style="width:100%"></video>
          </div>`;
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


// ── Card spotlight ───────────────────────────────────────────
function initCardSpotlight() {
  const grid = document.querySelector(".projects-grid");
  if (!grid) return;
  grid.addEventListener("mousemove", e => {
    const card = e.target.closest(".project-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--cx", (e.clientX - rect.left) + "px");
    card.style.setProperty("--cy", (e.clientY - rect.top)  + "px");
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
  initModal();
  initLightbox();
  initCardSpotlight();
  if (window.initCMS) window.initCMS();
  runIntro();
});
