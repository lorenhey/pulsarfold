/**
 * pulsar-app.js - Main Application Controller for pulsarfold workbench.
 * Controls data synthesis, real-time folding sliders, Web Audio sonification,
 * and astrophysical reporting.
 * 
 * Part of pulsarfold v2.0.0
 */

(function (window) {
  'use strict';

  class PulsarApp {
    constructor() {
      this.currentPulsarId = 'vela-b0833';
      this.currentPulsar = null;

      // Astrophysical parameters
      this.trialDm = 67.97;
      this.trialPeriodSec = 0.089328;
      this.nBins = 128;
      this.nSubints = 16;
      this.nSubbands = 16;
      this.colormap = 'turbo';

      // Synthetic raw observation buffer
      this.rawObservation = null;
      this.freqsMhz = null;
      this.sampleTimeSec = 0.000180;
      this.nSamples = 2048;
      this.nChans = 32;

      // Folded state & metrics
      this.foldedObj = null;
      this.prof1D = null;
      this.timePhaseMap = null;
      this.freqPhaseMap = null;
      this.currentMetrics = { snr: 0, reducedChi2: 0, fwhmPhase: 0, offStd: 0 };
      this.optResult = null;

      this.audioEngine = new window.PulsarEngine.PulsarAudioEngine();
    }

    init() {
      this.bindDOMElements();
      this.bindEvents();
      this.loadPulsar(this.currentPulsarId);
      this.initCli();
    }

    bindDOMElements() {
      this.dom = {
        // Visualizers
        canvasTimePhase: document.getElementById('canvas-time-phase'),
        canvasFreqPhase: document.getElementById('canvas-freq-phase'),
        containerProf1D: document.getElementById('container-prof-1d'),
        containerDmOpt: document.getElementById('container-dm-opt'),
        cliTerminal: document.getElementById('cli-terminal'),
        cliInput: document.getElementById('cli-input'),

        // Selectors & Sliders
        pulsarSelect: document.getElementById('pulsar-select'),
        colormapSelect: document.getElementById('colormap-select'),
        sliderDm: document.getElementById('slider-dm'),
        valDm: document.getElementById('val-dm'),
        sliderPeriod: document.getElementById('slider-period'),
        valPeriod: document.getElementById('val-period'),
        sliderBins: document.getElementById('slider-bins'),
        valBins: document.getElementById('val-bins'),

        // Playback Buttons
        btnPlayDedisp: document.getElementById('btn-play-dedisp'),
        btnPlayDisp: document.getElementById('btn-play-disp'),
        btnStopAudio: document.getElementById('btn-stop-audio'),
        btnOptimizeDm: document.getElementById('btn-optimize-dm'),
        btnResetParams: document.getElementById('btn-reset-params'),

        // KPI Cards
        kpiSnr: document.getElementById('kpi-snr'),
        kpiDm: document.getElementById('kpi-dm'),
        kpiPeriod: document.getElementById('kpi-period'),
        kpiChi2: document.getElementById('kpi-chi2'),
        kpiPulseWidth: document.getElementById('kpi-pulse-width'),
        kpiRotFreq: document.getElementById('kpi-rot-freq'),

        // Export
        btnExportJson: document.getElementById('btn-export-json'),
        btnExportCsv: document.getElementById('btn-export-csv')
      };
    }

    bindEvents() {
      // Tab switching
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          const targetId = tab.getAttribute('data-target');
          const targetContent = document.getElementById(targetId);
          if (targetContent) targetContent.classList.add('active');
          this.render();
        });
      });

      // Pulsar selector
      if (this.dom.pulsarSelect) {
        this.dom.pulsarSelect.addEventListener('change', (e) => {
          this.loadPulsar(e.target.value);
        });
      }

      // Colormap selector
      if (this.dom.colormapSelect) {
        this.dom.colormapSelect.addEventListener('change', (e) => {
          this.colormap = e.target.value;
          this.render();
        });
      }

      // DM Slider
      if (this.dom.sliderDm) {
        this.dom.sliderDm.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.setDm(val);
        });
      }

      // Period Slider
      if (this.dom.sliderPeriod) {
        this.dom.sliderPeriod.addEventListener('input', (e) => {
          const valMs = parseFloat(e.target.value);
          this.setPeriodMs(valMs);
        });
      }

      // Bins Slider
      if (this.dom.sliderBins) {
        this.dom.sliderBins.addEventListener('input', (e) => {
          const bins = parseInt(e.target.value, 10);
          this.nBins = bins;
          if (this.dom.valBins) this.dom.valBins.textContent = bins.toString();
          this.computeFold();
          this.render();
        });
      }

      // Action Buttons
      if (this.dom.btnPlayDedisp) {
        this.dom.btnPlayDedisp.addEventListener('click', () => this.playAudio('dedispersed'));
      }
      if (this.dom.btnPlayDisp) {
        this.dom.btnPlayDisp.addEventListener('click', () => this.playAudio('dispersed'));
      }
      if (this.dom.btnStopAudio) {
        this.dom.btnStopAudio.addEventListener('click', () => this.stopAudio());
      }
      if (this.dom.btnOptimizeDm) {
        this.dom.btnOptimizeDm.addEventListener('click', () => {
          this.runDmOptimization();
          this.render();
        });
      }
      if (this.dom.btnResetParams) {
        this.dom.btnResetParams.addEventListener('click', () => this.loadPulsar(this.currentPulsarId));
      }

      // Export Buttons
      if (this.dom.btnExportJson) {
        this.dom.btnExportJson.addEventListener('click', () => this.exportJsonReport());
      }
      if (this.dom.btnExportCsv) {
        this.dom.btnExportCsv.addEventListener('click', () => this.exportProfileCsv());
      }

      window.addEventListener('resize', () => this.render());
    }

    loadPulsar(pulsarId) {
      const p = window.PulsarCatalog.find(item => item.id === pulsarId) || window.PulsarCatalog[0];
      this.currentPulsarId = p.id;
      this.currentPulsar = p;

      this.trialDm = p.dmTrue;
      this.trialPeriodSec = p.periodSec;
      this.sampleTimeSec = p.sampleTimeUs / 1e6;
      this.nSamples = p.nSamples;
      this.nChans = p.nChans;

      // Setup frequencies array (high to low)
      const fCenter = p.fCenterMhz;
      const fHalfBw = p.fBandwidthMhz / 2.0;
      const fStart = fCenter + fHalfBw;
      const fStep = p.fBandwidthMhz / p.nChans;
      this.freqsMhz = new Float64Array(p.nChans);
      for (let c = 0; c < p.nChans; c++) {
        this.freqsMhz[c] = fStart - c * fStep;
      }

      // Update slider bounds & values
      if (this.dom.sliderDm) {
        const dmMax = Math.max(10.0, p.dmTrue * 2.0);
        this.dom.sliderDm.min = 0;
        this.dom.sliderDm.max = dmMax.toFixed(1);
        this.dom.sliderDm.step = (dmMax / 200).toFixed(2);
        this.dom.sliderDm.value = this.trialDm;
        if (this.dom.valDm) this.dom.valDm.textContent = `${this.trialDm.toFixed(2)} pc/cm³`;
      }

      if (this.dom.sliderPeriod) {
        const pMs = p.periodMs;
        this.dom.sliderPeriod.min = (pMs * 0.95).toFixed(3);
        this.dom.sliderPeriod.max = (pMs * 1.05).toFixed(3);
        this.dom.sliderPeriod.step = (pMs * 0.0002).toFixed(4);
        this.dom.sliderPeriod.value = pMs;
        if (this.dom.valPeriod) this.dom.valPeriod.textContent = `${pMs.toFixed(3)} ms`;
      }

      // Generate synthetic observation
      this.generateObservationData();

      // Fold & compute
      this.computeFold();
      this.runDmOptimization();
      this.render();
    }

    generateObservationData() {
      const p = this.currentPulsar;
      const totalCells = this.nSamples * this.nChans;
      this.rawObservation = new Float32Array(totalCells);

      // 1. Gaussian background noise
      for (let i = 0; i < totalCells; i++) {
        const u1 = Math.max(1e-12, Math.random());
        const u2 = Math.random();
        const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        this.rawObservation[i] = 10.0 + randNormal * 1.5;
      }

      // 2. Inject pulses with true cold plasma dispersion delays
      const delays = window.PulsarEngine.calculateDelays(this.freqsMhz, p.dmTrue);
      const totalTimeSec = this.nSamples * this.sampleTimeSec;
      const nPulses = Math.floor(totalTimeSec / p.periodSec);

      for (let pulseIdx = 0; pulseIdx < nPulses; pulseIdx++) {
        const pulseCenterT = pulseIdx * p.periodSec;

        p.pulseProfile.components.forEach(comp => {
          const compCenterT = pulseCenterT + comp.phase * p.periodSec;
          const compWidthSec = comp.width * p.periodSec;

          for (let c = 0; c < this.nChans; c++) {
            // Pulse arrives delayed at channel c
            const arrivalT = compCenterT + delays[c];
            const peakSamp = Math.round(arrivalT / this.sampleTimeSec);

            // Spread energy across samples according to Gaussian envelope
            const halfWinSamps = Math.max(2, Math.round((compWidthSec * 2.5) / this.sampleTimeSec));
            for (let s = -halfWinSamps; s <= halfWinSamps; s++) {
              const curSamp = peakSamp + s;
              if (curSamp >= 0 && curSamp < this.nSamples) {
                const dt = (curSamp * this.sampleTimeSec) - arrivalT;
                const env = Math.exp(-0.5 * Math.pow(dt / (compWidthSec * 0.45), 2));
                const signalAmp = comp.amplitude * 8.5 * env;
                this.rawObservation[curSamp * this.nChans + c] += signalAmp;
              }
            }
          }
        });
      }
    }

    computeFold() {
      if (!this.rawObservation) return;

      // 1. Incoherent Dedispersion
      const dedisp = window.PulsarEngine.dedisperse(
        this.rawObservation,
        this.nSamples,
        this.nChans,
        this.freqsMhz,
        this.sampleTimeSec,
        this.trialDm
      );

      // 2. Epoch Folding
      this.foldedObj = window.PulsarEngine.fold(
        dedisp,
        this.nSamples,
        this.nChans,
        this.sampleTimeSec,
        this.trialPeriodSec,
        this.nBins,
        this.nSubints,
        this.nSubbands
      );

      // 3. Collapsed 1D Profile & Maps
      this.prof1D = window.PulsarEngine.get1DProfile(this.foldedObj);
      this.timePhaseMap = window.PulsarEngine.getTimePhaseMap(this.foldedObj);
      this.freqPhaseMap = window.PulsarEngine.getFreqPhaseMap(this.foldedObj);

      // 4. Metrics
      this.currentMetrics = window.PulsarEngine.calculateSnr(this.prof1D);

      // 5. Update KPI Cards
      this.updateKpis();
    }

    runDmOptimization() {
      if (!this.rawObservation) return;
      const p = this.currentPulsar;
      const minDm = Math.max(0, p.dmTrue - 15.0);
      const maxDm = p.dmTrue + 15.0;

      this.optResult = window.PulsarEngine.optimizeDm(
        this.rawObservation,
        this.nSamples,
        this.nChans,
        this.freqsMhz,
        this.sampleTimeSec,
        this.trialPeriodSec,
        minDm,
        maxDm,
        25,
        64
      );
    }

    setDm(dmVal) {
      this.trialDm = Math.max(0, dmVal);
      if (this.dom.valDm) this.dom.valDm.textContent = `${this.trialDm.toFixed(2)} pc/cm³`;
      this.computeFold();
      this.render();
    }

    setPeriodMs(pMs) {
      this.trialPeriodSec = pMs / 1000.0;
      if (this.dom.valPeriod) this.dom.valPeriod.textContent = `${pMs.toFixed(3)} ms`;
      this.computeFold();
      this.render();
    }

    updateKpis() {
      const m = this.currentMetrics;
      const p = this.currentPulsar;

      if (this.dom.kpiSnr) {
        this.dom.kpiSnr.textContent = `${m.snr.toFixed(1)} σ`;
      }
      if (this.dom.kpiDm) {
        this.dom.kpiDm.textContent = `${this.trialDm.toFixed(2)}`;
      }
      if (this.dom.kpiPeriod) {
        this.dom.kpiPeriod.textContent = `${(this.trialPeriodSec * 1000).toFixed(3)} ms`;
      }
      if (this.dom.kpiChi2) {
        this.dom.kpiChi2.textContent = m.reducedChi2.toFixed(1);
      }
      if (this.dom.kpiPulseWidth) {
        this.dom.kpiPulseWidth.textContent = `${(m.fwhmPhase * 100).toFixed(1)}%`;
      }
      if (this.dom.kpiRotFreq) {
        const freqHz = 1.0 / this.trialPeriodSec;
        this.dom.kpiRotFreq.textContent = `${freqHz.toFixed(1)} Hz`;
      }
    }

    render() {
      // 1. Time vs Phase Heatmap
      if (this.dom.canvasTimePhase && this.timePhaseMap) {
        window.PulsarPlotter.renderHeatmap(this.dom.canvasTimePhase, this.timePhaseMap, { colormap: this.colormap });
      }

      // 2. Freq vs Phase Heatmap
      if (this.dom.canvasFreqPhase && this.freqPhaseMap) {
        window.PulsarPlotter.renderHeatmap(this.dom.canvasFreqPhase, this.freqPhaseMap, { colormap: this.colormap });
      }

      // 3. 1D Integrated Profile
      if (this.dom.containerProf1D && this.prof1D) {
        window.PulsarPlotter.renderIntegratedProfile(this.dom.containerProf1D, this.prof1D, this.currentMetrics);
      }

      // 4. DM Optimization Curve
      if (this.dom.containerDmOpt && this.optResult) {
        window.PulsarPlotter.renderDmOptimizationCurve(this.dom.containerDmOpt, this.optResult);
      }
    }

    playAudio(mode = 'dedispersed') {
      this.audioEngine.start(this.trialPeriodSec, this.trialDm, mode);
      if (mode === 'dedispersed' && this.dom.btnPlayDedisp) {
        this.dom.btnPlayDedisp.style.borderColor = '#00e676';
      } else if (mode === 'dispersed' && this.dom.btnPlayDisp) {
        this.dom.btnPlayDisp.style.borderColor = '#00e5ff';
      }
    }

    stopAudio() {
      this.audioEngine.stop();
      if (this.dom.btnPlayDedisp) this.dom.btnPlayDedisp.style.borderColor = '';
      if (this.dom.btnPlayDisp) this.dom.btnPlayDisp.style.borderColor = '';
    }

    getSummary() {
      const p = this.currentPulsar;
      const m = this.currentMetrics;
      return {
        name: p.name,
        designation: p.designation,
        periodMs: this.trialPeriodSec * 1000.0,
        freqHz: 1.0 / this.trialPeriodSec,
        trialDm: this.trialDm,
        dmTrue: p.dmTrue,
        snr: m.snr,
        reducedChi2: m.reducedChi2,
        fwhmPhase: m.fwhmPhase,
        nBins: this.nBins,
        nSamples: this.nSamples,
        nChans: this.nChans
      };
    }

    generateMarkdownReport() {
      const s = this.getSummary();
      return `
# Reporte Astrofísico de Plegado y Dedispersión de Púlsar
**Fuente:** ${s.name} (${s.designation})
**Fecha de Análisis:** ${new Date().toISOString()}

## 1. Parámetros de Sincronización y Plegado
- **Período de Plegado P:** ${s.periodMs.toFixed(4)} ms
- **Frecuencia de Rotación:** ${s.freqHz.toFixed(3)} Hz
- **Medida de Dispersión Ensayo (DM):** ${s.trialDm.toFixed(2)} pc cm⁻³ (Catálogo: ${s.dmTrue.toFixed(2)} pc cm⁻³)

## 2. Métricas de Detección y Calidad
- **Relación Señal-Ruido (S/N):** ${s.snr.toFixed(2)} σ
- **Chi-Cuadrado Reducido (χ²_red):** ${s.reducedChi2.toFixed(2)}
- **Ancho a Media Altura (W50 / FWHM):** ${(s.fwhmPhase * 100).toFixed(1)}% del ciclo de fase

## 3. Configuración de Ingesta y Cuadrícula
- **Canales de Radiofrecuencia:** ${s.nChans} sub-bandas
- **Muestras Temporales Integradas:** ${s.nSamples}
- **Resolución de Fase:** ${s.nBins} bins
      `.trim();
    }

    exportJsonReport() {
      const s = this.getSummary();
      const data = {
        pulsar_summary: s,
        metrics: this.currentMetrics,
        dm_optimization: this.optResult ? {
          best_dm: this.optResult.bestDm,
          best_snr: this.optResult.bestSnr,
          dms: Array.from(this.optResult.dms),
          snrs: Array.from(this.optResult.snrs)
        } : null,
        metadata: {
          software: 'PulsarFold',
          version: '2.0.0',
          engine: 'pulsar-engine.js'
        }
      };
      const str = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const a = document.createElement('a');
      a.href = str;
      a.download = `pulsarfold_${this.currentPulsarId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    exportProfileCsv() {
      if (!this.prof1D) return;
      let csv = 'phase_bin,phase_fraction,intensity\n';
      const n = this.prof1D.length;
      for (let i = 0; i < n; i++) {
        csv += `${i},${(i / n).toFixed(4)},${this.prof1D[i].toFixed(4)}\n`;
      }
      const str = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      const a = document.createElement('a');
      a.href = str;
      a.download = `pulsar_profile_${this.currentPulsarId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    initCli() {
      if (window.PulsarCli && this.dom.cliTerminal && this.dom.cliInput) {
        window.PulsarCli.init(this.dom.cliTerminal, this.dom.cliInput, this);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const app = new PulsarApp();
    app.init();
    window.pulsarApp = app;
  });

})(typeof window !== 'undefined' ? window : this);
