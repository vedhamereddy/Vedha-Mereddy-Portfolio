// ── PDF Export ───────────────────────────────────────────────

// Parse Jodit HTML into structured objects, preserving inline bold/italic as spans
function parseHtmlContent(html) {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  const result = [];

  // Recursively extract inline text as styled span objects
  function extractSpans(node, bold = false, italic = false) {
    const spans = [];
    if (node.nodeType === 3) {
      const text = node.textContent || '';
      if (text) spans.push({ text, bold, italic });
      return spans;
    }
    const tag = (node.tagName || '').toLowerCase();
    const b = bold || tag === 'strong' || tag === 'b';
    const it = italic || tag === 'em' || tag === 'i';
    for (const child of node.childNodes) spans.push(...extractSpans(child, b, it));
    return spans;
  }

  function processNode(node) {
    if (node.nodeType === 3) {
      const t = (node.textContent || '').trim();
      if (t) result.push({ type: 'paragraph', spans: [{ text: t, bold: false, italic: false }] });
      return;
    }
    const tag = (node.tagName || '').toLowerCase();

    if (tag === 'p' || tag === 'div') {
      const spans = extractSpans(node);
      if (spans.some(s => s.text.trim())) result.push({ type: 'paragraph', spans });
    } else if (tag === 'ul') {
      for (const li of node.querySelectorAll(':scope > li')) {
        const spans = extractSpans(li);
        if (spans.some(s => s.text.trim())) result.push({ type: 'bullet', spans });
      }
    } else if (tag === 'ol') {
      let n = 0;
      for (const li of node.querySelectorAll(':scope > li')) {
        n++;
        const spans = extractSpans(li);
        if (spans.some(s => s.text.trim())) result.push({ type: 'numbered', spans, num: n });
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
  return result.filter(item =>
    (item.spans && item.spans.some(s => s.text.trim())) ||
    (item.text  && item.text.trim()) ||
    (item.cells && item.cells.length)
  );
}

async function fetchImageAsBase64(url) {
  try {
    const res  = await fetch(url);
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
    const LH = 5.0; // base line height mm

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

    // How many mm remain on the current page
    function spaceLeft(y) { return PH - M - 12 - y; }

    // Load an image, but shrink its max height to fit remaining page space.
    // If less than minSpace remains, jump to next page first.
    async function loadImageFit(url, maxW, preferH, minSpace = 35) {
      const avail = spaceLeft(y);
      // Jump page if barely any room left
      if (avail < minSpace) { doc.addPage(); fillBg(); y = M + 4; }
      const fittedH = Math.min(preferH, spaceLeft(y) - 8);
      return loadImage(url, maxW, Math.max(fittedH, 20));
    }

    function fontStyle(bold, italic) {
      if (bold && italic) return 'bolditalic';
      if (bold) return 'bold';
      if (italic) return 'italic';
      return 'normal';
    }

    // Render spans with inline bold/italic, word-wrapping manually.
    // Returns new y.
    function renderSpans(spans, x, y, size, color, maxW) {
      if (!spans || !spans.length) return y;
      const lh = size * 0.46;

      // Tokenize into words, preserving style per token
      const tokens = [];
      for (const span of spans) {
        const words = span.text.split(' ');
        words.forEach((word, wi) => {
          if (word) tokens.push({ text: word, bold: span.bold, italic: span.italic });
          if (wi < words.length - 1) tokens.push({ text: ' ', bold: false, italic: false, space: true });
        });
      }

      // Measure a token (requires font to be set)
      function measure(token) {
        doc.setFont('helvetica', fontStyle(token.bold, token.italic));
        doc.setFontSize(size);
        return doc.getTextWidth(token.text);
      }

      // Pre-measure all tokens
      tokens.forEach(t => { t.w = measure(t); });

      // Build wrapped lines
      const lines = [];
      let current = [], currentW = 0;

      for (const token of tokens) {
        if (token.space) {
          if (current.length) { current.push(token); currentW += token.w; }
        } else if (currentW + token.w > maxW + 0.5 && current.some(t => !t.space)) {
          // Trim trailing spaces then flush
          while (current.length && current[current.length - 1].space) current.pop();
          lines.push([...current]);
          current = [token]; currentW = token.w;
        } else {
          current.push(token); currentW += token.w;
        }
      }
      while (current.length && current[current.length - 1].space) current.pop();
      if (current.length) lines.push(current);

      // Render each line
      for (const line of lines) {
        y = guard(y, lh + 1);
        let lx = x;
        doc.setTextColor(...color);
        for (const token of line) {
          doc.setFont('helvetica', fontStyle(token.bold, token.italic));
          doc.setFontSize(size);
          doc.text(token.text, lx, y);
          lx += token.w;
        }
        y += lh;
      }
      return y;
    }

    // Plain wrapped text (for summary, headings, tags — no inline styling needed)
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

    // Render a parsed block list — returns new y
    function renderContent(items, startY, colX = M, colW = CW) {
      let y = startY;
      for (const item of items) {

        if (item.type === 'paragraph') {
          y = renderSpans(item.spans, colX, y, 10, MID, colW);
          y += 2.5;

        } else if (item.type === 'bullet') {
          y = guard(y, LH + 1);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...MID);
          doc.text('•', colX + 1, y);
          const startY2 = y;
          y = renderSpans(item.spans, colX + 6, startY2, 10, MID, colW - 7);
          y += 1.2;

        } else if (item.type === 'numbered') {
          y = guard(y, LH + 1);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...MID);
          doc.text(`${item.num}.`, colX + 1, y);
          const startY2 = y;
          y = renderSpans(item.spans, colX + 7, startY2, 10, MID, colW - 8);
          y += 1.2;

        } else if (item.type === 'subheading') {
          y = guard(y, 8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...INK);
          doc.text(item.text, colX, y);
          y += 4;

        } else if (item.type === 'table-header' || item.type === 'table-row') {
          const colWCell = colW / Math.max(item.cells.length, 1);
          y = guard(y, 6);
          doc.setFont('helvetica', item.type === 'table-header' ? 'bold' : 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...(item.type === 'table-header' ? INK : MID));
          item.cells.forEach((cell, ci) => doc.text(String(cell).substring(0, 45), colX + ci * colWCell, y));
          y += 5;
        }
      }
      return y;
    }

    // ── Page 1 header ─────────────────────────────────────────
    fillBg();
    const projects = window._projects || PORTFOLIO.projects;

    const CX = PW / 2; // centre x

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text('VEDHA MEREDDY', CX, M + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setCharSpace(0.4);
    doc.text(
      `Design & Engineering Portfolio  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
      CX, M + 10.5, { align: 'center' }
    );
    doc.setCharSpace(0);
    let y = M + 18;

    // ── Projects ──────────────────────────────────────────────
    for (let idx = 0; idx < projects.length; idx++) {
      const p = projects[idx];

      if (idx > 0) { doc.addPage(); fillBg(); y = M; }

      y += 3;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...ACCENT);
      const titleLines = doc.splitTextToSize(p.title, CW);
      doc.text(titleLines, M, y);
      y += titleLines.length * 6.5 + 3;

      // Tags
      if (p.tags && p.tags.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.setCharSpace(0.8);
        doc.text(p.tags.join('   ·   ').toUpperCase(), M, y);
        doc.setCharSpace(0);
        y += 6;
      }

      y += 3;

      // Summary (italic)
      if (p.summary) {
        y = writeWrapped(p.summary, M, y, 10, MID, 'italic');
        y += 6;
      }

      // Thumbnail — 50% wide, shrinks to fit remaining page space (skip videos)
      if (p.image && !isVideoUrl(p.image)) {
        const img = await loadImageFit(p.image, CW * 0.5, 56);
        if (img) {
          try { doc.addImage(img.data, img.fmt, M + (CW - img.w) / 2, y, img.w, img.h, '', 'FAST'); } catch {}
          y += img.h + 10;
        }
      }

      // Content blocks
      if (p.blocks && p.blocks.length) {
        y += 2;

        for (const block of p.blocks) {

          if (block.type === 'heading' && block.content?.trim()) {
            y = guard(y, 8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...INK);
            doc.text(block.content.trim(), M, y);
            y += 4;

          } else if (block.type === 'text' && block.content) {
            const items = parseHtmlContent(block.content);
            if (items.length) { y = renderContent(items, y); y += 3; }

          } else if (block.type === 'image' && block.content) {
            const sizeRatio = parseFloat(block.size || '100') / 100;
            const img = await loadImageFit(block.content, CW * sizeRatio, 80);
            if (!img) continue;
            const x = block.align === 'center' ? M + (CW - img.w) / 2
              : block.align === 'right' ? M + CW - img.w : M;
            try { doc.addImage(img.data, img.fmt, x, y, img.w, img.h, '', 'FAST'); } catch {}
            y += img.h + 8;

          } else if (block.type === 'image-row' && block.images?.length) {
            const imgs = block.images.filter(im => im.url);
            if (!imgs.length) continue;
            const gap = 4, slotW = (CW - (imgs.length - 1) * gap) / imgs.length;
            const rowMaxH = Math.min(55, spaceLeft(y) - 8);
            if (spaceLeft(y) < 35) { doc.addPage(); fillBg(); y = M + 4; }
            const loaded = await Promise.all(imgs.map(im => loadImage(im.url, slotW, Math.max(rowMaxH, 20))));
            const rowH = Math.max(...loaded.filter(Boolean).map(im => im.h), 0);
            let xc = M;
            for (const img of loaded) {
              if (!img) { xc += slotW + gap; continue; }
              try { doc.addImage(img.data, img.fmt, xc, y, img.w, img.h, '', 'FAST'); } catch {}
              xc += slotW + gap;
            }
            y += rowH + 8;

          } else if (block.type === 'image-text') {
            const imgPct   = parseFloat(block.imageWidth || '40') / 100;
            const imgMaxW  = CW * imgPct;
            const textColW = CW * (1 - imgPct) - 6;
            const imgX     = block.imagePosition === 'right' ? M + textColW + 6 : M;
            const textX    = block.imagePosition === 'right' ? M : M + imgMaxW + 6;
            const img      = block.image ? await loadImageFit(block.image, imgMaxW, 80) : null;
            const items    = parseHtmlContent(block.content || '');

            // Estimate text height for guard
            doc.setFontSize(10);
            let estH = 0;
            for (const item of items) {
              if (!item.spans) continue;
              const plain = item.spans.map(s => s.text).join('');
              const indent = item.type === 'paragraph' ? 0 : 7;
              estH += doc.splitTextToSize(plain, textColW - indent).length * LH
                + (item.type === 'paragraph' ? 2.5 : 1.2);
            }
            const blockH = Math.max(img ? img.h : 0, estH) + 8;
            y = guard(y, blockH);
            if (img) { try { doc.addImage(img.data, img.fmt, imgX, y, img.w, img.h, '', 'FAST'); } catch {} }

            let ty = y;
            for (const item of items) {
              if (!item.spans) continue;
              if (item.type === 'bullet') {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...MID);
                doc.text('•', textX + 1, ty);
                ty = renderSpans(item.spans, textX + 6, ty, 10, MID, textColW - 7);
                ty += 1.2;
              } else {
                ty = renderSpans(item.spans, textX, ty, 10, MID, textColW);
                ty += 2.5;
              }
            }
            y += blockH;
          }
        }
      }

    }

    // ── Page numbers — bottom-right on every page ─────────────
    const total = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= total; pg++) {
      doc.setPage(pg);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(String(pg), PW - M, PH - 10, { align: 'right' });
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
