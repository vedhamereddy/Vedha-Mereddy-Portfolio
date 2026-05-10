// ── Portfolio CMS ────────────────────────────────────────────
let sb = null;
let currentUser = null;
let cmsProjects = null;

// ── Initialize ────────────────────────────────────────────────
async function initCMS() {
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase not available');
    return;
  }

  // Load projects from database
  await loadProjects();

  // Check if logged in
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    currentUser = user;
    enterAdminMode();
  }

  // Listen for auth changes
  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    if (currentUser) enterAdminMode();
    else exitAdminMode();
  });

  // Admin trigger: Ctrl+Shift+A
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      if (currentUser) adminLogout();
      else openLoginModal();
    }
  });
}

// ── Load projects ─────────────────────────────────────────────
async function loadProjects() {
  if (!sb) return;

  const { data, error } = await sb
    .from('projects')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Supabase load error:', error);
    return;
  }

  if (!data || data.length === 0) {
    cmsProjects = null;
    return;
  }

  cmsProjects = data.map(p => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    tags: p.tags || [],
    image: p.image_url,
    thumbnailPosition: p.thumbnail_position || 'center center',
    link: p.link,
    blocks: p.blocks || [],
    order_index: p.order_index,
    hidden: p.hidden || false,
  }));

  // Re-render with new data
  window._projects = cmsProjects;
  renderProjects(cmsProjects);
  setTimeout(() => {
    // Re-observe new cards for fade-in animation
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".projects-grid .fade-in").forEach(el => observer.observe(el));
    attachEditButtons();
  }, 100);
}

// ── Auth ──────────────────────────────────────────────────────
async function adminLogin(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function adminLogout() {
  await sb.auth.signOut();
}

// ── Admin mode ────────────────────────────────────────────────
function enterAdminMode() {
  document.body.classList.add('admin-mode');
  const toolbar = document.getElementById('admin-toolbar');
  if (toolbar) toolbar.classList.add('visible');
  closeLoginModal();
  attachEditButtons();
}

function exitAdminMode() {
  document.body.classList.remove('admin-mode');
  const toolbar = document.getElementById('admin-toolbar');
  if (toolbar) toolbar.classList.remove('visible');
  removeEditButtons();
}

function attachEditButtons() {
  document.querySelectorAll('.project-card').forEach(card => {
    if (card.querySelector('.admin-card-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'admin-card-controls';

    const editBtn = document.createElement('button');
    editBtn.className = 'admin-edit-btn';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Edit project';
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      const index = parseInt(card.dataset.index);
      const project = window._projects ? window._projects[index] : PORTFOLIO.projects[index];
      openEditModal(project, index);
    });

    const upBtn = document.createElement('button');
    upBtn.className = 'admin-order-btn';
    upBtn.innerHTML = '↑';
    upBtn.title = 'Move earlier';
    upBtn.addEventListener('click', e => {
      e.stopPropagation();
      moveProject(parseInt(card.dataset.index), -1);
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'admin-order-btn';
    downBtn.innerHTML = '↓';
    downBtn.title = 'Move later';
    downBtn.addEventListener('click', e => {
      e.stopPropagation();
      moveProject(parseInt(card.dataset.index), 1);
    });

    controls.appendChild(editBtn);
    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    card.appendChild(controls);
  });
}

function removeEditButtons() {
  document.querySelectorAll('.admin-card-controls').forEach(el => el.remove());
}

async function moveProject(index, direction) {
  const projects = window._projects;
  if (!projects) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= projects.length) return;

  const a = projects[index];
  const b = projects[newIndex];
  if (!a?.id || !b?.id) return;

  // Use array positions as order_index if values are identical
  let orderA = a.order_index ?? index;
  let orderB = b.order_index ?? newIndex;
  if (orderA === orderB) { orderA = index; orderB = newIndex; }

  await Promise.all([
    sb.from('projects').update({ order_index: orderB }).eq('id', a.id),
    sb.from('projects').update({ order_index: orderA }).eq('id', b.id),
  ]);

  await loadProjects();
}

// ── Login modal ───────────────────────────────────────────────
function openLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) modal.classList.add('open');
}

function closeLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.classList.remove('open');
    const errEl = document.getElementById('admin-login-error');
    if (errEl) errEl.textContent = '';
  }
}

// ── Edit modal ────────────────────────────────────────────────
let editingProject = null;
let editingBlocks = [];
let joditInstances = {};

function openEditModal(project, index) {
  editingProject = project || {
    id: null,
    title: '',
    summary: '',
    tags: [],
    link: '',
    order_index: index ?? (cmsProjects ? cmsProjects.length : 0),
    blocks: [],
    thumbnailPosition: 'center center',
    hidden: false,
  };

  editingBlocks = JSON.parse(JSON.stringify(editingProject.blocks || [])).map(b =>
    b.type === 'image' ? { ...b, size: b.size || '100%' } : b
  );

  const modal = document.getElementById('admin-edit-modal');
  if (!modal) return;

  modal.querySelector('#edit-title').value = editingProject.title || '';
  modal.querySelector('#edit-summary').value = editingProject.summary || '';
  modal.querySelector('#edit-tags').value = (editingProject.tags || []).join(', ');
  modal.querySelector('#edit-link').value = editingProject.link || '';

  const deleteBtn = modal.querySelector('#edit-delete-btn');
  deleteBtn.style.display = editingProject.id ? 'flex' : 'none';

  const title = modal.querySelector('.admin-modal-title');
  title.textContent = editingProject.id ? 'Edit Project' : 'Add Project';

  // Thumbnail preview + focal point picker
  const previewWrap = modal.querySelector('#edit-image-preview-wrap');
  const previewImg  = modal.querySelector('#edit-image-preview');
  const focalRow    = modal.querySelector('#focal-point-row');
  const currentPos  = editingProject.thumbnailPosition || 'center center';
  const thumbIsVideo = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(editingProject.image || '');
  if (previewWrap && previewImg) {
    if (editingProject.image) {
      previewImg.src = editingProject.image;
      if (!thumbIsVideo) previewImg.style.objectPosition = currentPos;
      previewWrap.style.display = 'block';
    } else {
      previewImg.src = '';
      previewWrap.style.display = 'none';
    }
  }
  if (focalRow) focalRow.style.display = thumbIsVideo ? 'none' : '';
  modal.querySelectorAll('.fp-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === currentPos);
  });
  const hiddenInput = modal.querySelector('#edit-hidden-input');
  if (hiddenInput) hiddenInput.checked = editingProject.hidden || false;

  renderBlockEditor();
  modal.classList.add('open');
}

// ── Block editor ──────────────────────────────────────────────
function flushEditorContent() {
  Object.entries(joditInstances).forEach(([i, editor]) => {
    const idx = parseInt(i);
    try {
      if (editingBlocks[idx] !== undefined) {
        editingBlocks[idx].content = editor.value;
      }
      editor.destruct();
    } catch {}
  });
  joditInstances = {};
}

function blockInsertZone(index) {
  return `<div class="block-insert-zone" id="insert-zone-${index}">
    <div class="block-insert-line"></div>
    <button class="block-insert-btn" type="button" onclick="toggleInsertMenu(${index})" title="Insert block here">+</button>
    <div class="block-insert-line"></div>
    <div class="block-insert-menu" id="insert-menu-${index}">
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'text')">Text</button>
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'heading')">Heading</button>
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'image')">Image</button>
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'image-row')">Image Row</button>
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'image-text')">Image + Text</button>
      <button class="block-insert-type-btn" type="button" onclick="insertBlock(${index},'video')">Video</button>
    </div>
  </div>`;
}

function toggleInsertMenu(index) {
  const zone = document.getElementById(`insert-zone-${index}`);
  const isOpen = zone?.classList.contains('menu-open');
  document.querySelectorAll('.block-insert-zone').forEach(z => z.classList.remove('menu-open'));
  if (!isOpen) zone?.classList.add('menu-open');
}

function insertBlock(index, type) {
  flushEditorContent();
  const block = { type, content: '' };
  if (type === 'image-row')  block.images = [];
  if (type === 'image-text') { block.image = ''; block.imageWidth = '40%'; block.imagePosition = 'left'; }
  if (type === 'video')      { block.loop = true; block.size = '100%'; }
  editingBlocks.splice(index, 0, block);
  renderBlockEditor();
  setTimeout(() => {
    const items = document.querySelectorAll('#blocks-container .block-item');
    if (items[index]) items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 50);
}

function renderBlockEditor() {
  flushEditorContent();

  const container = document.getElementById('blocks-container');
  if (!container) return;

  container.innerHTML = editingBlocks.map((block, i) => `
    ${blockInsertZone(i)}
    <div class="block-item">
      <div class="block-actions">
        <button class="block-btn" onclick="moveBlock(${i}, -1)">↑</button>
        <button class="block-btn" onclick="moveBlock(${i}, 1)">↓</button>
        <button class="block-btn danger" onclick="removeBlock(${i})">✕</button>
      </div>
      <select class="block-type" data-index="${i}">
        <option value="text"       ${block.type === 'text'       ? 'selected' : ''}>Text</option>
        <option value="heading"    ${block.type === 'heading'    ? 'selected' : ''}>Heading</option>
        <option value="image"      ${block.type === 'image'      ? 'selected' : ''}>Image</option>
        <option value="image-row"  ${block.type === 'image-row'  ? 'selected' : ''}>Image Row</option>
        <option value="image-text" ${block.type === 'image-text' ? 'selected' : ''}>Image + Text</option>
        <option value="video"      ${block.type === 'video'      ? 'selected' : ''}>Video</option>
      </select>
      ${block.type === 'text'
        ? `<textarea class="block-jodit" id="editor-${i}"></textarea>`
        : block.type === 'image'
          ? `<div class="block-image-upload">
               ${block.content ? `<img src="${block.content}" class="block-image-preview" />` : ''}
               <label class="admin-btn block-upload-btn">
                 <span>${block.content ? 'Change Image' : 'Upload Image'}</span>
                 <input type="file" accept="image/*" class="block-image-input" data-index="${i}" />
               </label>
               <div class="block-image-controls">
                 <select class="block-image-size" data-index="${i}">
                   <option value="100%" ${(block.size||'100%')==='100%'?'selected':''}>Full width</option>
                   <option value="75%"  ${block.size==='75%' ?'selected':''}>Large (75%)</option>
                   <option value="50%"  ${block.size==='50%' ?'selected':''}>Medium (50%)</option>
                   <option value="33%"  ${block.size==='33%' ?'selected':''}>Small (33%)</option>
                 </select>
                 <select class="block-image-align" data-index="${i}">
                   <option value="left"   ${(block.align||'left')==='left'  ?'selected':''}>Left</option>
                   <option value="center" ${block.align==='center'?'selected':''}>Center</option>
                   <option value="right"  ${block.align==='right' ?'selected':''}>Right</option>
                 </select>
               </div>
             </div>`
          : block.type === 'image-row'
            ? `<div class="block-image-row-editor">
                 <div class="block-image-row-slots" id="row-slots-${i}">
                   ${(block.images||[]).map((img, j) => `
                     <div class="block-image-row-slot">
                       ${img.url ? `<img src="${img.url}" class="block-image-preview" />` : '<div class="block-image-empty">No image</div>'}
                       <label class="admin-btn block-upload-btn">
                         <span>${img.url ? 'Change' : 'Upload'}</span>
                         <input type="file" accept="image/*" class="block-row-image-input" data-index="${i}" data-img-index="${j}" />
                       </label>
                       <button class="admin-btn danger" onclick="removeRowImage(${i},${j})" style="margin-top:0.25rem;">Remove</button>
                     </div>
                   `).join('')}
                 </div>
                 <button class="admin-btn" onclick="addRowImage(${i})" style="margin-top:0.5rem;">+ Add Image to Row</button>
               </div>`
            : block.type === 'image-text'
              ? `<div class="block-image-text-editor">
                   <div class="block-image-controls" style="margin-bottom:0.5rem;">
                     <select class="block-it-position" data-index="${i}">
                       <option value="left"  ${(block.imagePosition||'left')==='left' ?'selected':''}>Image Left</option>
                       <option value="right" ${block.imagePosition==='right'?'selected':''}>Image Right</option>
                     </select>
                     <select class="block-it-width" data-index="${i}">
                       <option value="30%" ${(block.imageWidth||'40%')==='30%'?'selected':''}>Narrow (30%)</option>
                       <option value="40%" ${(block.imageWidth||'40%')==='40%'?'selected':''}>Medium (40%)</option>
                       <option value="50%" ${block.imageWidth==='50%'?'selected':''}>Half (50%)</option>
                     </select>
                   </div>
                   <div class="block-image-upload" style="margin-bottom:0.75rem;">
                     ${block.image ? `<img src="${block.image}" class="block-image-preview" />` : ''}
                     <label class="admin-btn block-upload-btn">
                       <span>${block.image ? 'Change Image' : 'Upload Image'}</span>
                       <input type="file" accept="image/*" class="block-it-image-input" data-index="${i}" />
                     </label>
                   </div>
                   <textarea class="block-jodit" id="editor-${i}"></textarea>
                 </div>`
              : block.type === 'video'
                ? `<div class="block-video-upload">
                     ${block.content ? `<video src="${block.content}" class="block-video-preview" autoplay muted playsinline loop></video>` : ''}
                     <label class="admin-btn block-upload-btn">
                       <span>${block.content ? 'Change Video' : 'Upload Video'}</span>
                       <input type="file" accept="video/*" class="block-video-input" data-index="${i}" />
                     </label>
                     <div class="block-image-controls" style="margin-top:0.5rem;">
                       <select class="block-video-size" data-index="${i}">
                         <option value="100%" ${(block.size||'100%')==='100%'?'selected':''}>Full width</option>
                         <option value="75%"  ${block.size==='75%' ?'selected':''}>Large (75%)</option>
                         <option value="50%"  ${block.size==='50%' ?'selected':''}>Medium (50%)</option>
                         <option value="33%"  ${block.size==='33%' ?'selected':''}>Small (33%)</option>
                       </select>
                       <label class="block-loop-label">
                         <input type="checkbox" class="block-video-loop" data-index="${i}" ${block.loop !== false ? 'checked' : ''} />
                         Loop
                       </label>
                     </div>
                   </div>`
                : `<textarea class="block-content" placeholder="Section title" data-index="${i}">${block.content || ''}</textarea>`
      }
    </div>
  `).join('') + blockInsertZone(editingBlocks.length);

  // Initialize Jodit for text and image-text blocks
  const joditConfig = {
    theme: 'dark',
    buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'indent', 'outdent', '|', 'table', '|', 'link', 'unlink', '|', 'fontsize', '|', 'eraser'],
    showXPathInStatusbar: false,
    showCharsCounter: false,
    showWordsCounter: false,
    toolbarAdaptive: false,
  };

  editingBlocks.forEach((block, i) => {
    if (block.type !== 'text' && block.type !== 'image-text') return;
    const editor = Jodit.make(`#editor-${i}`, {
      ...joditConfig,
      height: block.type === 'image-text' ? 180 : 260,
    });
    editor.value = block.content || '';
    editor.events.on('change', () => {
      editingBlocks[i].content = editor.value;
    });
    joditInstances[i] = editor;
  });

  // Image file upload listeners
  container.querySelectorAll('.block-image-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const i = parseInt(e.target.dataset.index);
      const span = e.target.previousElementSibling;
      span.textContent = 'Uploading…';
      try {
        const url = await uploadProjectImage(file);
        editingBlocks[i].content = url;
        renderBlockEditor();
      } catch (err) {
        alert('Image upload failed: ' + err.message);
        span.textContent = 'Upload Image';
      }
    });
  });

  // Image+Text block listeners
  container.querySelectorAll('.block-it-image-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const i = parseInt(e.target.dataset.index);
      const span = e.target.previousElementSibling;
      span.textContent = 'Uploading…';
      try {
        const url = await uploadProjectImage(file);
        editingBlocks[i].image = url;
        renderBlockEditor();
      } catch (err) {
        alert('Upload failed: ' + err.message);
        span.textContent = 'Upload Image';
      }
    });
  });
  container.querySelectorAll('.block-it-position').forEach(select => {
    select.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].imagePosition = e.target.value;
    });
  });
  container.querySelectorAll('.block-it-width').forEach(select => {
    select.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].imageWidth = e.target.value;
    });
  });

  // Image size/align listeners
  container.querySelectorAll('.block-image-size').forEach(select => {
    select.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].size = e.target.value;
    });
  });
  container.querySelectorAll('.block-image-align').forEach(select => {
    select.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].align = e.target.value;
    });
  });

  // Image row upload listeners
  container.querySelectorAll('.block-row-image-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const i   = parseInt(e.target.dataset.index);
      const j   = parseInt(e.target.dataset.imgIndex);
      const span = e.target.previousElementSibling;
      span.textContent = 'Uploading…';
      try {
        const url = await uploadProjectImage(file);
        editingBlocks[i].images[j].url = url;
        renderBlockEditor();
      } catch (err) {
        alert('Upload failed: ' + err.message);
        span.textContent = 'Upload';
      }
    });
  });

  // Video upload listeners
  container.querySelectorAll('.block-video-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const i = parseInt(e.target.dataset.index);
      const span = e.target.previousElementSibling;
      span.textContent = 'Uploading…';
      try {
        const url = await uploadProjectImage(file);
        editingBlocks[i].content = url;
        renderBlockEditor();
      } catch (err) {
        alert('Video upload failed: ' + err.message);
        span.textContent = 'Upload Video';
      }
    });
  });
  container.querySelectorAll('.block-video-size').forEach(select => {
    select.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].size = e.target.value;
    });
  });
  container.querySelectorAll('.block-video-loop').forEach(checkbox => {
    checkbox.addEventListener('change', e => {
      editingBlocks[parseInt(e.target.dataset.index)].loop = e.target.checked;
    });
  });

  // Attach listeners for non-Jodit text inputs
  container.querySelectorAll('.block-type').forEach(select => {
    select.addEventListener('change', e => {
      const i = parseInt(e.target.dataset.index);
      const newType = e.target.value;
      editingBlocks[i].type = newType;
      if (newType === 'image-row'  && !editingBlocks[i].images) editingBlocks[i].images = [];
      if (newType === 'image-text' && !editingBlocks[i].image) { editingBlocks[i].image = ''; editingBlocks[i].imageWidth = '40%'; editingBlocks[i].imagePosition = 'left'; }
      if (newType === 'video' && editingBlocks[i].loop === undefined) { editingBlocks[i].loop = true; editingBlocks[i].size = '100%'; }
      renderBlockEditor();
    });
  });

  container.querySelectorAll('.block-content').forEach(input => {
    input.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.index);
      editingBlocks[i].content = e.target.value;
    });
  });
}

function addBlock(type = 'text') {
  const block = { type, content: '' };
  if (type === 'image-row')  { block.images = []; }
  if (type === 'image-text') { block.image = ''; block.imageWidth = '40%'; block.imagePosition = 'left'; }
  if (type === 'video')      { block.loop = true; block.size = '100%'; }
  editingBlocks.push(block);
  renderBlockEditor();
}

function addRowImage(blockIndex) {
  if (!editingBlocks[blockIndex].images) editingBlocks[blockIndex].images = [];
  editingBlocks[blockIndex].images.push({ url: '' });
  renderBlockEditor();
  const blockItems = document.querySelectorAll('#blocks-container .block-item');
  if (blockItems[blockIndex]) {
    blockItems[blockIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function removeRowImage(blockIndex, imgIndex) {
  editingBlocks[blockIndex].images.splice(imgIndex, 1);
  renderBlockEditor();
  const blockItems = document.querySelectorAll('#blocks-container .block-item');
  if (blockItems[blockIndex]) {
    blockItems[blockIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function removeBlock(index) {
  flushEditorContent(); // save & destruct all editors before mutating the array
  editingBlocks.splice(index, 1);
  renderBlockEditor();
}

function moveBlock(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= editingBlocks.length) return;
  flushEditorContent();
  [editingBlocks[index], editingBlocks[newIndex]] = [editingBlocks[newIndex], editingBlocks[index]];
  renderBlockEditor();
  // Scroll the moved block into view so the user doesn't lose their place
  const blockItems = document.querySelectorAll('#blocks-container .block-item');
  if (blockItems[newIndex]) {
    blockItems[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function closeEditModal() {
  flushEditorContent();
  const modal = document.getElementById('admin-edit-modal');
  if (modal) modal.classList.remove('open');
  editingProject = null;
}

// ── Image upload ──────────────────────────────────────────────
async function uploadProjectImage(file) {
  const ext = file.name.split('.').pop();
  const path = `project-${Date.now()}.${ext}`;

  const { error } = await sb.storage
    .from('project-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = sb.storage.from('project-images').getPublicUrl(path);
  return data.publicUrl;
}

// ── Save project ──────────────────────────────────────────────
let pendingImageFile = null;

async function saveProject() {
  const modal = document.getElementById('admin-edit-modal');
  const saveBtn = modal.querySelector('#edit-save-btn');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  try {
    flushEditorContent();
    let imageUrl = editingProject.image || '';

    if (pendingImageFile) {
      imageUrl = await uploadProjectImage(pendingImageFile);
      pendingImageFile = null;
    }

    const payload = {
      title: modal.querySelector('#edit-title').value.trim(),
      summary: modal.querySelector('#edit-summary').value.trim(),
      tags: modal
        .querySelector('#edit-tags')
        .value.split(',')
        .map(t => t.trim())
        .filter(Boolean),
      link: modal.querySelector('#edit-link').value.trim(),
      blocks: editingBlocks,
      image_url: imageUrl,
      thumbnail_position: editingProject.thumbnailPosition || 'center center',
      order_index: editingProject.order_index || 0,
      hidden: editingProject.hidden || false,
    };

    if (editingProject.id) {
      await sb.from('projects').update(payload).eq('id', editingProject.id);
    } else {
      await sb.from('projects').insert([payload]);
    }

    await loadProjects();
    closeEditModal();
  } catch (err) {
    alert('Error saving: ' + err.message);
  } finally {
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
  }
}

// ── Delete project ────────────────────────────────────────────
async function deleteProject() {
  if (!editingProject?.id) return;
  if (!confirm(`Delete "${editingProject.title}"? This cannot be undone.`)) return;

  await sb.from('projects').delete().eq('id', editingProject.id);
  await loadProjects();
  closeEditModal();
}

// ── Wire up DOM ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
      const errEl = document.getElementById('admin-login-error');
      const btn = e.target.querySelector('button[type="submit"]');

      btn.textContent = 'Logging in…';
      btn.disabled = true;
      try {
        await adminLogin(email, password);
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        btn.textContent = 'Log in';
        btn.disabled = false;
      }
    });
  }

  // Close login modal
  const loginClose = document.getElementById('admin-login-close');
  if (loginClose) loginClose.addEventListener('click', closeLoginModal);

  const loginBackdrop = document.getElementById('admin-login-backdrop');
  if (loginBackdrop) loginBackdrop.addEventListener('click', closeLoginModal);

  // Admin toolbar
  const addBtn = document.getElementById('admin-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => openEditModal(null));

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);

  // Edit modal
  const editSaveBtn = document.querySelector('#admin-edit-modal #edit-save-btn');
  if (editSaveBtn) editSaveBtn.addEventListener('click', saveProject);

  const editDeleteBtn = document.querySelector('#admin-edit-modal #edit-delete-btn');
  if (editDeleteBtn) editDeleteBtn.addEventListener('click', deleteProject);

  const editClose = document.getElementById('admin-edit-close');
  if (editClose) editClose.addEventListener('click', closeEditModal);

  const editBackdrop = document.getElementById('admin-edit-backdrop');
  if (editBackdrop) editBackdrop.addEventListener('click', closeEditModal);

  // Image file input
  const imageInput = document.getElementById('edit-image-input');
  if (imageInput) {
    imageInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      pendingImageFile = file;
      const isVideo     = file.type.startsWith('video/');
      const preview     = document.getElementById('edit-image-preview');
      const previewWrap = document.getElementById('edit-image-preview-wrap');
      const focalRow    = document.getElementById('focal-point-row');
      const objectUrl   = URL.createObjectURL(file);

      // Swap preview element type if needed
      if (isVideo) {
        // Replace <img> preview with <video> preview
        const vid = document.createElement('video');
        vid.id = 'edit-image-preview';
        vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
        vid.style.cssText = preview.style.cssText;
        vid.className = preview.className;
        vid.src = objectUrl;
        preview.replaceWith(vid);
        if (focalRow) focalRow.style.display = 'none';
      } else {
        // Ensure we have an <img> (user may have previously selected a video)
        const img = document.createElement('img');
        img.id = 'edit-image-preview';
        img.style.cssText = preview.style.cssText;
        img.className = preview.className;
        const pos = editingProject?.thumbnailPosition || 'center center';
        img.src = objectUrl;
        img.style.objectPosition = pos;
        preview.replaceWith(img);
        if (focalRow) focalRow.style.display = '';
        document.querySelectorAll('.fp-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.pos === pos);
        });
      }

      if (previewWrap) previewWrap.style.display = 'block';
    });
  }

  // Hidden toggle
  document.getElementById('edit-hidden-input')?.addEventListener('change', e => {
    if (editingProject) editingProject.hidden = e.target.checked;
  });

  // Focal point grid
  document.getElementById('focal-point-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.fp-btn');
    if (!btn) return;
    e.preventDefault();
    const pos = btn.dataset.pos;
    if (editingProject) editingProject.thumbnailPosition = pos;
    document.querySelectorAll('.fp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preview = document.getElementById('edit-image-preview');
    if (preview) preview.style.objectPosition = pos;
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeLoginModal();
    }
  });
});
