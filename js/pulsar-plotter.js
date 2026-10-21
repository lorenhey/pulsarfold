/**
 * pulsar-plotter.js - High-performance Canvas and SVG visualizers for
 * sub-integrations vs phase, frequency vs phase dedispersion maps,
 * 1D integrated pulse profiles, and DM SNR optimization curves.
 * 
 * Part of pulsarfold v2.0.0
 */

(function (window) {
  'use strict';

  const PulsarPlotter = {
    colormaps: {
      turbo: function (t) {
        t = Math.max(0, Math.min(1, t));
        const r = Math.round(Math.max(0, 255 * (0.1357 + t * (4.5974 - t * (42.3277 - t * (130.5887 - t * (150.5667 - t * 58.1375)))))));
        const g = Math.round(Math.max(0, 255 * (0.0914 + t * (2.1856 + t * (4.8052 - t * (14.0195 + t * (4.2109 + t * 2.7747)))))));
        const b = Math.round(Math.max(0, 255 * (0.1067 + t * (12.5732 - t * (80.1472 - t * (213.3644 - t * (255.6741 - t * 111.4589)))))));
        return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
      },
      magma: function (t) {
        t = Math.max(0, Math.min(1, t));
        const r = Math.round(Math.min(255, 255 * (Math.pow(t, 0.7) * 1.1)));
        const g = Math.round(Math.min(255, 255 * (Math.pow(t, 1.8) * 0.9)));
        const b = Math.round(Math.min(255, 255 * (Math.pow(t, 0.4) * 0.7 + Math.sin(t * Math.PI) * 0.3)));
        return [r, g, b];
      },
      matrixCyan: function (t) {
        t = Math.max(0, Math.min(1, t));
        const r = Math.round(5 + 35 * Math.pow(t, 2));
        const g = Math.round(15 + 235 * Math.pow(t, 1.2));
        const b = Math.round(30 + 225 * t);
        return [r, g, b];
      }
    },

    /**
     * Renders 2D Heatmap (e.g. Sub-integrations vs Phase or Sub-bands vs Phase)
     */
    renderHeatmap: function (canvas, mapObj, options = {}) {
      if (!canvas || !mapObj) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      const data = mapObj.data;
      const nRows = mapObj.nSubints || mapObj.nSubbands || 16;
      const nCols = mapObj.nBins || 128;

      ctx.clearRect(0, 0, w, h);

      // Min/Max for dynamic range
      let minVal = Infinity, maxVal = -Infinity;
      for (let i = 0; i < data.length; i++) {
        if (data[i] < minVal) minVal = data[i];
        if (data[i] > maxVal) maxVal = data[i];
      }
      const range = (maxVal - minVal) > 1e-6 ? (maxVal - minVal) : 1.0;

      const cmapKey = options.colormap || 'turbo';
      const cmap = PulsarPlotter.colormaps[cmapKey] || PulsarPlotter.colormaps.turbo;

      // Render onto an offscreen image data of size nCols x nRows
      const imgData = ctx.createImageData(nCols, nRows);
      const px = imgData.data;

      for (let r = 0; r < nRows; r++) {
        for (let c = 0; c < nCols; c++) {
          const val = data[r * nCols + c];
          const norm = Math.max(0, Math.min(1, (val - minVal) / range));
          const [red, green, blue] = cmap(norm);

          const idx = (r * nCols + c) * 4;
          px[idx] = red;
          px[idx + 1] = green;
          px[idx + 2] = blue;
          px[idx + 3] = 255;
        }
      }

      // Draw scaled up to full canvas with crisp pixelation
      const offscreen = document.createElement('canvas');
      offscreen.width = nCols;
      offscreen.height = nRows;
      offscreen.getContext('2d').putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, w, h);

      // Draw subtle grid overlay
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const xQuarters = [0.25, 0.5, 0.75];
      xQuarters.forEach(q => {
        const qx = Math.round(q * w);
        ctx.beginPath();
        ctx.moveTo(qx, 0);
        ctx.lineTo(qx, h);
        ctx.stroke();
      });
    },

    /**
     * Renders 1D Integrated Pulse Profile I(phase) in SVG
     */
    renderIntegratedProfile: function (container, prof1D, metrics) {
      if (!container) return;
      if (!prof1D || prof1D.length === 0) {
        container.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">Sin perfil integrado disponible.</div>';
        return;
      }

      const w = container.clientWidth || 550;
      const h = 220;
      const padL = 50, padR = 25, padT = 30, padB = 35;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const n = prof1D.length;
      let minVal = Infinity, maxVal = -Infinity;
      for (let i = 0; i < n; i++) {
        if (prof1D[i] < minVal) minVal = prof1D[i];
        if (prof1D[i] > maxVal) maxVal = prof1D[i];
      }
      const valRange = (maxVal - minVal) > 1e-6 ? (maxVal - minVal) : 1.0;
      const yMin = minVal - valRange * 0.08;
      const yMax = maxVal + valRange * 0.12;

      function mapX(i) {
        return padL + (i / Math.max(1, n - 1)) * plotW;
      }
      function mapY(v) {
        return padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
      }

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: system-ui, sans-serif;">`;

      // Off-pulse noise baseline & band
      const yBase = mapY(metrics.offMean);
      const yBandTop = mapY(metrics.offMean + metrics.offStd);
      const yBandBot = mapY(metrics.offMean - metrics.offStd);
      const bandH = Math.max(1, yBandBot - yBandTop);

      svg += `<rect x="${padL}" y="${yBandTop}" width="${plotW}" height="${bandH}" fill="rgba(0, 229, 255, 0.08)" />`;
      svg += `<line x1="${padL}" y1="${yBase}" x2="${w - padR}" y2="${yBase}" stroke="#334863" stroke-dasharray="3,3" stroke-width="1.2" />`;

      // Phase grid lines: 0.0, 0.25, 0.5, 0.75, 1.0
      [0.0, 0.25, 0.5, 0.75, 1.0].forEach(phase => {
        const px = padL + phase * plotW;
        svg += `<line x1="${px}" y1="${padT}" x2="${px}" y2="${h - padB}" stroke="#182436" stroke-width="1" />`;
        svg += `<text x="${px}" y="${h - 12}" fill="#64748b" font-size="10" text-anchor="middle">${phase.toFixed(2)}</text>`;
      });

      // Shaded area under the curve
      let areaPoints = `${padL},${h - padB} `;
      for (let i = 0; i < n; i++) {
        areaPoints += `${mapX(i).toFixed(1)},${mapY(prof1D[i]).toFixed(1)} `;
      }
      areaPoints += `${mapX(n - 1)},${h - padB}`;
      svg += `<polygon points="${areaPoints}" fill="url(#profGrad)" opacity="0.25" />`;

      // Curve polyline
      let points = '';
      for (let i = 0; i < n; i++) {
        points += `${mapX(i).toFixed(1)},${mapY(prof1D[i]).toFixed(1)} `;
      }
      svg += `<polyline points="${points}" fill="none" stroke="#00e5ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`;

      // Gradient definition
      svg += `
        <defs>
          <linearGradient id="profGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
      `;

      // Header title & metrics
      svg += `<text x="${padL}" y="18" fill="#ffffff" font-size="12" font-weight="bold">Perfil Integrado de Pulso I(φ)</text>`;
      svg += `<text x="${w - padR}" y="18" fill="#00e5ff" font-size="11" text-anchor="end" font-family="'JetBrains Mono', monospace">S/N: ${metrics.snr.toFixed(1)} | χ²_red: ${metrics.reducedChi2.toFixed(1)} | W50: ${(metrics.fwhmPhase * 100).toFixed(1)}%</text>`;

      svg += '</svg>';
      container.innerHTML = svg;
    },

    /**
     * Renders DM Optimization Curve (S/N vs trial DM)
     */
    renderDmOptimizationCurve: function (container, optResult) {
      if (!container) return;
      if (!optResult || !optResult.dms || optResult.dms.length === 0) {
        container.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">Sin datos de optimización DM.</div>';
        return;
      }

      const w = container.clientWidth || 550;
      const h = 220;
      const padL = 55, padR = 25, padT = 30, padB = 35;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const dms = optResult.dms;
      const snrs = optResult.snrs;
      const n = dms.length;

      const minDm = dms[0], maxDm = dms[n - 1];
      let maxSnr = Math.max(1, ...snrs);

      function mapX(dmVal) {
        return padL + ((dmVal - minDm) / (maxDm - minDm)) * plotW;
      }
      function mapY(snrVal) {
        return padT + plotH - (snrVal / (maxSnr * 1.15)) * plotH;
      }

      let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="font-family: system-ui, sans-serif;">`;

      // Axes grid
      const nTicks = 5;
      for (let i = 0; i <= nTicks; i++) {
        const dmVal = minDm + (i / nTicks) * (maxDm - minDm);
        const px = mapX(dmVal);
        svg += `<line x1="${px}" y1="${padT}" x2="${px}" y2="${h - padB}" stroke="#182436" stroke-width="1" />`;
        svg += `<text x="${px}" y="${h - 12}" fill="#64748b" font-size="10" text-anchor="middle">${dmVal.toFixed(1)}</text>`;
      }

      // Draw polyline curve
      let points = '';
      for (let i = 0; i < n; i++) {
        points += `${mapX(dms[i]).toFixed(1)},${mapY(snrs[i]).toFixed(1)} `;
      }
      svg += `<polyline points="${points}" fill="none" stroke="#ffd600" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;

      // Plot data points
      for (let i = 0; i < n; i++) {
        svg += `<circle cx="${mapX(dms[i])}" cy="${mapY(snrs[i])}" r="3.5" fill="#ffd600" stroke="#080c14" stroke-width="1.5" />`;
      }

      // Best DM vertical indicator
      const bestX = mapX(optResult.bestDm);
      const bestY = mapY(optResult.bestSnr);
      svg += `<line x1="${bestX}" y1="${padT}" x2="${bestX}" y2="${h - padB}" stroke="#ff4081" stroke-width="1.5" stroke-dasharray="3,3" />`;
      svg += `<circle cx="${bestX}" cy="${bestY}" r="5" fill="#ff4081" stroke="#ffffff" stroke-width="1.5" />`;

      // Title & Peak label
      svg += `<text x="${padL}" y="18" fill="#ffffff" font-size="12" font-weight="bold">Búsqueda y Optimización de DM (Curva S/N vs. DM)</text>`;
      svg += `<text x="${w - padR}" y="18" fill="#ffd600" font-size="11" text-anchor="end" font-family="'JetBrains Mono', monospace">Óptimo: ${optResult.bestDm.toFixed(2)} pc/cm³ (S/N: ${optResult.bestSnr.toFixed(1)})</text>`;

      svg += '</svg>';
      container.innerHTML = svg;
    }
  };

  window.PulsarPlotter = PulsarPlotter;
})(typeof window !== 'undefined' ? window : this);
