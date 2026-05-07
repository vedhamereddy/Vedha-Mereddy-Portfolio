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

async function exportProjectsPDF() {
  const btn = document.getElementById('export-pdf-btn');
  btn.textContent = 'Generating…';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const W       = 210;
    const H       = 297;
    const margin  = 18;
    const cw      = W - margin * 2;

    // ── Palette ──────────────────────────────────────────────
    const BG      = [15,  13,  10];
    const INK     = [242, 237, 228];
    const MID     = [190, 183, 172];
    const MUTED   = [120, 112, 104];
    const ACCENT  = [201, 169, 127];
    const BORDER  = [42,  37,  30];

    function bg() {
      doc.setFillColor(...BG);
      doc.rect(0, 0, W, H, 'F');
    }

    function hRule(y, opacity = 1) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.25);
      doc.line(margin, y, W - margin, y);
    }

    function checkPage(y, needed = 20) {
      if (y + needed > H - margin) {
        doc.addPage();
        bg();
        return margin;
      }
      return y;
    }

    // ── Cover page ───────────────────────────────────────────
    bg();

    // Left accent bar
    doc.setFillColor(...ACCENT);
    doc.rect(margin, 70, 1.2, 42, 'F');

    // Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(...INK);
    doc.text('VEDHA', margin + 6, 88);

    doc.setTextColor(...ACCENT);
    doc.text('MEREDDY', margin + 6, 103);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('DESIGN & ENGINEERING PORTFOLIO', margin + 6, 115);

    hRule(122);

    // Date + project count
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const projects = window._projects || PORTFOLIO.projects;
    doc.text(
      `${projects.length} Projects  ·  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
      margin + 6, 129
    );

    // Table of contents
    let tocY = 160;
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('CONTENTS', margin, tocY);
    tocY += 6;
    hRule(tocY);
    tocY += 6;

    projects.forEach((p, i) => {
      doc.setTextColor(...MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${String(i + 1).padStart(2, '0')}  ${p.title}`, margin, tocY);
      tocY += 6.5;
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('vedhamereddy.github.io/Vedha-Mereddy-Portfolio', margin, H - 12);

    // ── Project pages ────────────────────────────────────────
    for (let idx = 0; idx < projects.length; idx++) {
      const p = projects[idx];
      doc.addPage();
      bg();

      let y = margin;

      // Index label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${String(idx + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`, margin, y);
      y += 5;

      hRule(y);
      y += 9;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...ACCENT);
      const titleLines = doc.splitTextToSize(p.title, cw);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 8 + 3;

      // Tags
      if (p.tags && p.tags.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(p.tags.join('   ·   ').toUpperCase(), margin, y);
        y += 9;
      }

      // Summary
      if (p.summary) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MID);
        const sumLines = doc.splitTextToSize(p.summary, cw);
        doc.text(sumLines, margin, y);
        y += sumLines.length * 5 + 8;
      }

      // Project thumbnail image
      if (p.image) {
        const imgData = await fetchImageAsBase64(p.image);
        if (imgData) {
          const imgH = 55;
          y = checkPage(y, imgH + 6);
          try {
            doc.addImage(imgData, 'JPEG', margin, y, cw, imgH, '', 'FAST');
            y += imgH + 8;
          } catch {}
        }
      }

      // Content blocks
      if (p.blocks && p.blocks.length > 0) {
        // Divider before blocks
        hRule(y);
        y += 8;

        for (const block of p.blocks) {
          if (block.type === 'heading') {
            const text = (block.content || '').trim();
            if (!text) continue;
            y = checkPage(y, 12);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...INK);
            doc.text(text, margin, y);
            y += 7;

          } else if (block.type === 'text') {
            const text = htmlToText(block.content);
            if (!text) continue;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...MID);
            const lines = doc.splitTextToSize(text, cw);
            for (const line of lines) {
              y = checkPage(y, 5);
              doc.text(line, margin, y);
              y += 4.8;
            }
            y += 3;

          } else if (block.type === 'image' && block.content) {
            const imgData = await fetchImageAsBase64(block.content);
            if (!imgData) continue;
            const sizeRatio = parseFloat(block.size || '100') / 100;
            const imgW = cw * sizeRatio;
            const imgH = 50;
            y = checkPage(y, imgH + 6);
            const xOffset = block.align === 'center' ? margin + (cw - imgW) / 2
              : block.align === 'right' ? margin + (cw - imgW) : margin;
            try {
              doc.addImage(imgData, 'JPEG', xOffset, y, imgW, imgH, '', 'FAST');
              y += imgH + 6;
            } catch {}

          } else if (block.type === 'image-row' && block.images?.length) {
            const imgs = block.images.filter(im => im.url);
            if (!imgs.length) continue;
            const slotW = (cw - (imgs.length - 1) * 4) / imgs.length;
            const rowH  = 45;
            y = checkPage(y, rowH + 6);
            for (let j = 0; j < imgs.length; j++) {
              const imgData = await fetchImageAsBase64(imgs[j].url);
              if (!imgData) continue;
              try {
                doc.addImage(imgData, 'JPEG', margin + j * (slotW + 4), y, slotW, rowH, '', 'FAST');
              } catch {}
            }
            y += rowH + 6;
          }
        }
      }

      // Page number at bottom
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`${idx + 2}`, W / 2, H - 10, { align: 'center' });
    }

    doc.save(`Vedha-Mereddy-Portfolio.pdf`);
  } catch (err) {
    alert('PDF export failed: ' + err.message);
  } finally {
    btn.textContent = '↓ Export PDF';
    btn.disabled = false;
  }
}
