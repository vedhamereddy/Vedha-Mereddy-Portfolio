// ── PDF Export ───────────────────────────────────────────────

function htmlToText(html) {
  if (!html) return '';
  html = html.replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n');
  html = html.replace(/<[^>]+>/g, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
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

// Scale image to fit within maxW x maxH preserving aspect ratio
function fitImage(natW, natH, maxW, maxH) {
  const ratio = natW / natH;
  let w = maxW;
  let h = w / ratio;
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

    const PW     = 210;
    const PH     = 297;
    const M      = 20;   // margin
    const CW     = PW - M * 2; // content width

    // ── Palette (light) ──────────────────────────────────────
    const BG     = [252, 250, 247];
    const INK    = [18,  15,  12];
    const MID    = [70,  62,  54];
    const MUTED  = [140, 130, 120];
    const ACCENT = [160, 120, 72];
    const BORDER = [210, 204, 196];

    function fillBg() {
      doc.setFillColor(...BG);
      doc.rect(0, 0, PW, PH, 'F');
    }

    function rule(y, x1 = M, x2 = PW - M) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.25);
      doc.line(x1, y, x2, y);
    }

    // Adds a new page if remaining space < needed, returns new y
    function guard(y, needed) {
      if (y + needed > PH - M) {
        doc.addPage();
        fillBg();
        return M;
      }
      return y;
    }

    // Writes wrapped text, returns new y
    function writeText(text, x, y, size, color, style = 'normal', maxW = CW) {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach(line => {
        y = guard(y, size * 0.4);
        doc.text(line, x, y);
        y += size * 0.42;
      });
      return y;
    }

    // ── Compact header (top of page 1) ───────────────────────
    fillBg();
    const projects = window._projects || PORTFOLIO.projects;

    // Name + subtitle on one line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text('VEDHA MEREDDY', M, M + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Design & Engineering Portfolio  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
      M, M + 8
    );

    rule(M + 13);

    let firstProjectY = M + 22; // projects start right after header

    // ── Project pages ────────────────────────────────────────
    for (let idx = 0; idx < projects.length; idx++) {
      const p = projects[idx];

      if (idx === 0) {
        // First project continues on page 1 after the header
      } else {
        doc.addPage();
        fillBg();
        firstProjectY = M;
      }

      let y = firstProjectY;

      // Index / count
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${String(idx + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`, M, y);
      y += 5;

      rule(y);
      y += 10;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...ACCENT);
      const titleLines = doc.splitTextToSize(p.title, CW);
      doc.text(titleLines, M, y);
      y += titleLines.length * 9 + 3;

      // Tags
      if (p.tags && p.tags.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(p.tags.join('   ·   ').toUpperCase(), M, y);
        y += 10;
      }

      // Summary
      if (p.summary) {
        y = writeText(p.summary, M, y, 10, MID);
        y += 6;
      }

      // Thumbnail — constrained width and proper aspect ratio
      if (p.image) {
        const img = await loadImage(p.image, CW * 0.7, 65);
        if (img) {
          y = guard(y, img.h + 10);
          const x = M + (CW - img.w) / 2;
          try { doc.addImage(img.data, img.fmt, x, y, img.w, img.h, '', 'FAST'); } catch {}
          y += img.h + 10;
        }
      }

      // Content blocks
      if (p.blocks && p.blocks.length > 0) {
        rule(y);
        y += 9;

        for (const block of p.blocks) {

          if (block.type === 'heading' && block.content?.trim()) {
            y = guard(y, 14);
            y = writeText(block.content.trim(), M, y, 11, INK, 'bold');
            y += 3;

          } else if (block.type === 'text' && block.content) {
            const text = htmlToText(block.content);
            if (!text) continue;
            // Render line by line to handle bullet points cleanly
            const paragraphs = text.split('\n').filter(l => l.trim());
            for (const para of paragraphs) {
              y = guard(y, 6);
              y = writeText(para, M, y, 9, MID);
            }
            y += 4;

          } else if (block.type === 'image' && block.content) {
            const sizeRatio  = parseFloat(block.size  || '100') / 100;
            const maxW = CW * sizeRatio;
            const img = await loadImage(block.content, maxW, 75);
            if (!img) continue;
            y = guard(y, img.h + 8);
            const x = block.align === 'center' ? M + (CW - img.w) / 2
              : block.align === 'right'  ? M + CW - img.w : M;
            try { doc.addImage(img.data, img.fmt, x, y, img.w, img.h, '', 'FAST'); } catch {}
            y += img.h + 8;

          } else if (block.type === 'image-row' && block.images?.length) {
            const imgs = block.images.filter(im => im.url);
            if (!imgs.length) continue;
            const slotMaxW = (CW - (imgs.length - 1) * 4) / imgs.length;
            const maxH = 55;
            const loaded = await Promise.all(imgs.map(im => loadImage(im.url, slotMaxW, maxH)));
            const rowH = Math.max(...loaded.filter(Boolean).map(im => im.h));
            y = guard(y, rowH + 8);
            let xCursor = M;
            for (const img of loaded) {
              if (!img) { xCursor += slotMaxW + 4; continue; }
              try { doc.addImage(img.data, img.fmt, xCursor, y, img.w, img.h, '', 'FAST'); } catch {}
              xCursor += slotMaxW + 4;
            }
            y += rowH + 8;

          } else if (block.type === 'image-text') {
            const imgWidthPct = parseFloat(block.imageWidth || '40') / 100;
            const textW = CW * (1 - imgWidthPct) - 6;
            const imgMaxW = CW * imgWidthPct;
            const text = htmlToText(block.content || '');
            const paragraphs = text.split('\n').filter(l => l.trim());

            let img = null;
            if (block.image) img = await loadImage(block.image, imgMaxW, 80);

            const imgH = img ? img.h : 0;
            // Estimate text height
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            let estTextH = 0;
            for (const para of paragraphs) {
              const lines = doc.splitTextToSize(para, textW);
              estTextH += lines.length * 9 * 0.42 + 2;
            }
            const blockH = Math.max(imgH, estTextH) + 8;
            y = guard(y, blockH);

            const imgX = block.imagePosition === 'right' ? M + textW + 6 : M;
            const textX = block.imagePosition === 'right' ? M : M + imgMaxW + 6;

            if (img) {
              try { doc.addImage(img.data, img.fmt, imgX, y, img.w, img.h, '', 'FAST'); } catch {}
            }

            let ty = y;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...MID);
            for (const para of paragraphs) {
              const lines = doc.splitTextToSize(para, textW);
              lines.forEach(line => {
                doc.text(line, textX, ty);
                ty += 9 * 0.42;
              });
              ty += 2;
            }

            y += blockH;
          }
        }
      }

      // Page number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(String(idx + 2), PW / 2, PH - 10, { align: 'center' });
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
