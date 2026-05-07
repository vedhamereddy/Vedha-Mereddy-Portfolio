// ── PDF Export ───────────────────────────────────────────────

// Parse Jodit HTML into structured objects for clean PDF rendering
function parseHtmlContent(html) {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  const result = [];

  function processNode(node) {
    if (node.nodeType === 3) {
      const t = (node.textContent || '').trim();
      if (t) result.push({ type: 'paragraph', text: t });
      return;
    }
    const tag = (node.tagName || '').toLowerCase();
    if (tag === 'p' || tag === 'div') {
      const t = (node.textContent || '').trim();
      if (t) result.push({ type: 'paragraph', text: t });
    } else if (tag === 'ul') {
      for (const li of node.querySelectorAll(':scope > li')) {
        const t = (li.textContent || '').trim();
        if (t) result.push({ type: 'bullet', text: t });
      }
    } else if (tag === 'ol') {
      let n = 0;
      for (const li of node.querySelectorAll(':scope > li')) {
        n++;
        const t = (li.textContent || '').trim();
        if (t) result.push({ type: 'numbered', text: t, num: n });
      }
    } else if (/^h[1-6]$/.test(tag)) {
      const t = (node.textContent || '').trim();
      if (t) result.push({ type: 'subheading', text: t });
    } else if (tag === 'table') {
      node.querySelectorAll('tr').forEach((row, ri) => {
        const cells = Array.from(row.querySelectorAll('td, th'))
          .map(c => (c.textContent || '').trim()).filter(Boolean);
        if (cells.length) result.push({ type: ri === 0 ? 'table-header' : 'table-row', cells });
      });
    } else if (tag === 'br' || tag === 'hr') {
      // skip
    } else {
      for (const child of node.childNodes) processNode(child);
    }
  }

  for (const child of div.childNodes) processNode(child);
  return result.filter(item => (item.text && item.text.trim()) || (item.cells && item.cells.length));
}

async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function getImageDimensions(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

function fitImage(natW, natH, maxW, maxH) {
  const ratio = natW / natH;
  let w = maxW, h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w, h };
}

function imgFormat(dataUrl) {
  const m = dataUrl.match(/^data:image\/(\w+);/);
  if (!m) return 'JPEG';
  const t = m[1].toUpperCase();
  return t === 'JPG' ? 'JPEG' : t;
}

async function loadImage(url, maxW, maxH) {
  const data = await fetchImageAsBase64(url);
  if (!data) return null;
  const { w: natW, h: natH } = await getImageDimensions(data);
  const { w, h } = fitImage(natW, natH, maxW, maxH);
  return { data, w, h, fmt: imgFormat(data) };
}

async function exportProjectsPDF() {
  const btn = document.getElementById('export-pdf-btn');
  btn.textContent = 'Generating…';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const PW = 210, PH = 297, M = 22, CW = PW - M * 2;
    const LH = 5.0;   // base line height (mm)

    const BG     = [252, 250, 247];
    const INK    = [22,  18,  14];
    const MID    = [78,  66,  54];
    const MUTED  = [148, 136, 122];
    const ACCENT = [160, 118, 68];
    const BORDER = [214, 207, 198];

    // ── Helpers ──────────────────────────────────────────────

    function fillBg() {
      doc.setFillColor(...BG);
      doc.rect(0, 0, PW, PH, 'F');
    }

    function rule(y, x1 = M, x2 = PW - M) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(x1, y, x2, y);
    }

    function guard(y, needed) {
      if (y + needed > PH - M - 12) {
        doc.addPage();
        fillBg();
        return M + 4;
      }
      return y;
    }

    // Wrapped text block — returns new y
    function writeWrapped(text, x, y, size, color, style = 'normal', maxW = CW) {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lh = size * 0.46;
      for (const line of doc.splitTextToSize(text, maxW)) {
        y = guard(y, lh + 1);
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    }

    // Render parsed HTML content lines — returns new y
    function renderContent(items, startY, colX = M, colW = CW) {
      let y = startY;
      for (const item of items) {

        if (item.type === 'paragraph') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...MID);
          for (const line of doc.splitTextToSize(item.text, colW)) {
            y = guard(y, LH + 1);
            doc.text(line, colX, y);
            y += LH;
          }
          y += 2.5; // paragraph gap

        } else if (item.type === 'bullet') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...MID);
          const wrapped = doc.splitTextToSize(item.text, colW - 8);
          y = guard(y, LH + 1);
          doc.text('—', colX + 1, y);
          for (let i = 0; i < wrapped.length; i++) {
            if (i > 0) y = guard(y, LH + 1);
            doc.text(wrapped[i], colX + 7, y);
            y += LH;
          }
          y += 1.2;

        } else if (item.type === 'numbered') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...MID);
          const wrapped = doc.splitTextToSize(item.text, colW - 8);
          y = guard(y, LH + 1);
          doc.setFont('helvetica', 'bold');
          doc.text(`${item.num}.`, colX + 1, y);
          doc.setFont('helvetica', 'normal');
          for (let i = 0; i < wrapped.length; i++) {
            if (i > 0) y = guard(y, LH + 1);
            doc.text(wrapped[i], colX + 7, y);
            y += LH;
          }
          y += 1.2;

        } else if (item.type === 'subheading') {
          y += 2;
          y = guard(y, 9);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(...INK);
          doc.text(item.text, colX, y);
          y += 6.5;

        } else if (item.type === 'table-header' || item.type === 'table-row') {
          const colWCell = colW / Math.max(item.cells.length, 1);
          y = guard(y, 6);
          if (item.type === 'table-header') {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...INK);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...MID);
          }
          doc.setFontSize(9);
          item.cells.forEach((cell, ci) => {
            doc.text(String(cell).substring(0, 45), colX + ci * colWCell, y);
          });
          y += 5;
          if (item.type === 'table-header') rule(y - 1, colX, colX + colW);
        }
      }
      return y;
    }

    // ── Page 1 header ─────────────────────────────────────────
    fillBg();
    const projects = window._projects || PORTFOLIO.projects;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text('VEDHA MEREDDY', M, M + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Design & Engineering Portfolio  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
      M, M + 9.5
    );
    rule(M + 15);
    let y = M + 24;

    // ── Projects ──────────────────────────────────────────────
    for (let idx = 0; idx < projects.length; idx++) {
      const p = projects[idx];

      if (idx > 0) {
        doc.addPage();
        fillBg();
        y = M;
      }

      // ── Project header ──────────────────────────────────────

      // Counter
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${String(idx + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`, M, y);
      y += 4.5;
      rule(y);
      y += 12;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...ACCENT);
      const titleLines = doc.splitTextToSize(p.title, CW);
      doc.text(titleLines, M, y);
      y += titleLines.length * 8.8 + 5;

      // Tags
      if (p.tags && p.tags.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.setCharSpace(0.8);
        doc.text(p.tags.join('   ·   ').toUpperCase(), M, y);
        doc.setCharSpace(0);
        y += 9;
      }

      rule(y);
      y += 11;

      // Summary (italic)
      if (p.summary) {
        y = writeWrapped(p.summary, M, y, 10.5, MID, 'italic');
        y += 10;
      }

      // Thumbnail — max 50% wide so it doesn't dominate
      if (p.image) {
        const img = await loadImage(p.image, CW * 0.5, 56);
        if (img) {
          y = guard(y, img.h + 10);
          const x = M + (CW - img.w) / 2;
          try { doc.addImage(img.data, img.fmt, x, y, img.w, img.h, '', 'FAST'); } catch {}
          y += img.h + 12;
        }
      }

      // ── Content blocks ──────────────────────────────────────
      if (p.blocks && p.blocks.length) {
        rule(y);
        y += 12;

        for (const block of p.blocks) {

          // Section heading
          if (block.type === 'heading' && block.content?.trim()) {
            y = guard(y, 16);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12.5);
            doc.setTextColor(...INK);
            doc.text(block.content.trim(), M, y);
            y += 4;
            // Short accent underline
            doc.setDrawColor(...ACCENT);
            doc.setLineWidth(0.5);
            doc.line(M, y, M + 24, y);
            doc.setLineWidth(0.2);
            y += 8;

          // Rich text
          } else if (block.type === 'text' && block.content) {
            const items = parseHtmlContent(block.content);
            if (items.length) {
              y = renderContent(items, y);
              y += 3;
            }

          // Single image
          } else if (block.type === 'image' && block.content) {
            const sizeRatio = parseFloat(block.size || '100') / 100;
            const img = await loadImage(block.content, CW * sizeRatio, 80);
            if (!img) continue;
            y = guard(y, img.h + 8);
            const x = block.align === 'center' ? M + (CW - img.w) / 2
              : block.align === 'right' ? M + CW - img.w : M;
            try { doc.addImage(img.data, img.fmt, x, y, img.w, img.h, '', 'FAST'); } catch {}
            y += img.h + 8;

          // Image row
          } else if (block.type === 'image-row' && block.images?.length) {
            const imgs = block.images.filter(im => im.url);
            if (!imgs.length) continue;
            const gap = 4;
            const slotW = (CW - (imgs.length - 1) * gap) / imgs.length;
            const loaded = await Promise.all(imgs.map(im => loadImage(im.url, slotW, 55)));
            const rowH = Math.max(...loaded.filter(Boolean).map(im => im.h), 0);
            y = guard(y, rowH + 8);
            let xc = M;
            for (const img of loaded) {
              if (!img) { xc += slotW + gap; continue; }
              try { doc.addImage(img.data, img.fmt, xc, y, img.w, img.h, '', 'FAST'); } catch {}
              xc += slotW + gap;
            }
            y += rowH + 8;

          // Image + text side by side
          } else if (block.type === 'image-text') {
            const imgPct   = parseFloat(block.imageWidth || '40') / 100;
            const imgMaxW  = CW * imgPct;
            const textColW = CW * (1 - imgPct) - 6;
            const imgX     = block.imagePosition === 'right' ? M + textColW + 6 : M;
            const textX    = block.imagePosition === 'right' ? M : M + imgMaxW + 6;

            const img   = block.image ? await loadImage(block.image, imgMaxW, 80) : null;
            const items = parseHtmlContent(block.content || '');

            // Estimate text column height
            doc.setFontSize(10);
            let estTextH = 0;
            for (const item of items) {
              if (!item.text) continue;
              const indent = item.type === 'paragraph' ? 0 : 8;
              const lines  = doc.splitTextToSize(item.text, textColW - indent);
              estTextH += lines.length * LH + (item.type === 'paragraph' ? 2.5 : 1.2);
            }

            const blockH = Math.max(img ? img.h : 0, estTextH) + 8;
            y = guard(y, blockH);

            if (img) {
              try { doc.addImage(img.data, img.fmt, imgX, y, img.w, img.h, '', 'FAST'); } catch {}
            }

            // Render text column inline (no guard — already guarded above)
            let ty = y;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...MID);
            for (const item of items) {
              if (!item.text) continue;
              if (item.type === 'bullet') {
                doc.text('—', textX, ty);
                for (const l of doc.splitTextToSize(item.text, textColW - 7)) {
                  doc.text(l, textX + 6, ty);
                  ty += LH;
                }
                ty += 1.2;
              } else {
                for (const l of doc.splitTextToSize(item.text, textColW)) {
                  doc.text(l, textX, ty);
                  ty += LH;
                }
                ty += 2.5;
              }
            }
            y += blockH;
          }
        }
      }

      // Page number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(String(doc.internal.getNumberOfPages()), PW / 2, PH - 10, { align: 'center' });
    }

    doc.save('Vedha-Mereddy-Portfolio.pdf');

  } catch (err) {
    console.error(err);
    alert('PDF export failed: ' + err.message);
  } finally {
    btn.textContent = '↓ Export PDF';
    btn.disabled = false;
  }
}
