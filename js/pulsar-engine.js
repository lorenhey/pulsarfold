/**
 * pulsar-engine.js - Rigorous astrophysical processing engine for pulsar observations.
 * Handles cold plasma dispersion delays, incoherent dedispersion, epoch folding,
 * signal-to-noise ratio estimation, chi-squared metrics, and Web Audio sonification.
 * 
 * Part of pulsarfold v2.0.0
 */

(function (window) {
  'use strict';

  // Dispersion constant: k_DM in MHz^2 pc^-1 cm^3 s
  const K_DM = 4.148808e3;

  /**
   * Calculates cold plasma dispersion time delay (in seconds)
   * dt = K_DM * DM * (1 / nu^2 - 1 / nu_ref^2)
   */
  function calculateDelays(freqsMhz, dm, refFreqMhz = null) {
    const n = freqsMhz.length;
    const delays = new Float64Array(n);
    const refF = refFreqMhz !== null ? refFreqMhz : Math.max(...freqsMhz);
    const invRef2 = 1.0 / (refF * refF);

    for (let i = 0; i < n; i++) {
      const f = freqsMhz[i];
      delays[i] = K_DM * dm * ((1.0 / (f * f)) - invRef2);
    }
    return delays;
  }

  /**
   * Incoherent dedispersion on a 2D time-frequency array: data[timeIdx * nChans + chanIdx]
   */
  function dedisperse(data, nSamples, nChans, freqsMhz, sampleTimeSec, dm, refFreqMhz = null) {
    const delays = calculateDelays(freqsMhz, dm, refFreqMhz);
    const outData = new Float32Array(nSamples * nChans);

    for (let c = 0; c < nChans; c++) {
      const shiftBins = Math.round(delays[c] / sampleTimeSec);
      for (let t = 0; t < nSamples; t++) {
        // Roll backwards to align delayed low-frequency signals
        let srcT = (t + shiftBins) % nSamples;
        if (srcT < 0) srcT += nSamples;
        outData[t * nChans + c] = data[srcT * nChans + c];
      }
    }
    return outData;
  }

  /**
   * Folds a time-frequency observation into (nSubints, nSubbands, nBins)
   */
  function fold(data, nSamples, nChans, sampleTimeSec, periodSec, nBins = 128, nSubints = 8, nSubbands = 8) {
    const folded = new Float32Array(nSubints * nSubbands * nBins);
    const counts = new Int32Array(nSubints * nSubbands * nBins);

    const samplesPerSubint = Math.floor(nSamples / nSubints);
    const chansPerSubband = Math.floor(nChans / nSubbands);

    for (let t = 0; t < nSamples; t++) {
      const timeSec = t * sampleTimeSec;
      const phase = (timeSec / periodSec) % 1.0;
      let binIdx = Math.floor(phase * nBins);
      if (binIdx >= nBins) binIdx = nBins - 1;

      let subintIdx = Math.floor(t / samplesPerSubint);
      if (subintIdx >= nSubints) subintIdx = nSubints - 1;

      for (let c = 0; c < nChans; c++) {
        let subbandIdx = Math.floor(c / chansPerSubband);
        if (subbandIdx >= nSubbands) subbandIdx = nSubbands - 1;

        const val = data[t * nChans + c];
        const destIdx = (subintIdx * nSubbands + subbandIdx) * nBins + binIdx;
        folded[destIdx] += val;
        counts[destIdx] += 1;
      }
    }

    // Normalize by counts
    for (let i = 0; i < folded.length; i++) {
      if (counts[i] > 0) {
        folded[i] /= counts[i];
      }
    }

    return {
      foldedData: folded,
      nSubints: nSubints,
      nSubbands: nSubbands,
      nBins: nBins,
      periodSec: periodSec
    };
  }

  /**
   * Collapses 3D folded array to 1D Integrated Profile I(phase)
   */
  function get1DProfile(foldedObj) {
    const { foldedData, nSubints, nSubbands, nBins } = foldedObj;
    const prof1D = new Float32Array(nBins);
    const totalSlices = nSubints * nSubbands;

    for (let s = 0; s < totalSlices; s++) {
      for (let b = 0; b < nBins; b++) {
        prof1D[b] += foldedData[s * nBins + b];
      }
    }
    for (let b = 0; b < nBins; b++) {
      prof1D[b] /= totalSlices;
    }
    return prof1D;
  }

  /**
   * Collapses 3D folded array to 2D Sub-integrations vs Phase (Time vs Phase Heatmap)
   */
  function getTimePhaseMap(foldedObj) {
    const { foldedData, nSubints, nSubbands, nBins } = foldedObj;
    const map = new Float32Array(nSubints * nBins);

    for (let si = 0; si < nSubints; si++) {
      for (let b = 0; b < nBins; b++) {
        let sum = 0;
        for (let sb = 0; sb < nSubbands; sb++) {
          sum += foldedData[(si * nSubbands + sb) * nBins + b];
        }
        map[si * nBins + b] = sum / nSubbands;
      }
    }
    return { data: map, nSubints: nSubints, nBins: nBins };
  }

  /**
   * Collapses 3D folded array to 2D Sub-bands vs Phase (Freq vs Phase Heatmap)
   */
  function getFreqPhaseMap(foldedObj) {
    const { foldedData, nSubints, nSubbands, nBins } = foldedObj;
    const map = new Float32Array(nSubbands * nBins);

    for (let sb = 0; sb < nSubbands; sb++) {
      for (let b = 0; b < nBins; b++) {
        let sum = 0;
        for (let si = 0; si < nSubints; si++) {
          sum += foldedData[(si * nSubbands + sb) * nBins + b];
        }
        map[sb * nBins + b] = sum / nSubints;
      }
    }
    return { data: map, nSubbands: nSubbands, nBins: nBins };
  }

  /**
   * Estimates SNR and off-pulse baseline from 1D profile
   */
  function calculateSnr(prof1D) {
    const n = prof1D.length;
    if (n === 0) return { snr: 0, offMean: 0, offStd: 0, maxVal: 0, chi2: 0, fwhmPhase: 0 };

    // Sort to extract off-pulse region (lowest 75% of phase bins)
    const sorted = Array.from(prof1D).sort((a, b) => a - b);
    const nOff = Math.max(1, Math.floor(n * 0.75));
    let offSum = 0;
    for (let i = 0; i < nOff; i++) offSum += sorted[i];
    const offMean = offSum / nOff;

    let offVar = 0;
    for (let i = 0; i < nOff; i++) {
      const diff = sorted[i] - offMean;
      offVar += diff * diff;
    }
    const offStd = Math.sqrt(offVar / nOff);

    let maxVal = -Infinity;
    let maxIdx = 0;
    for (let i = 0; i < n; i++) {
      if (prof1D[i] > maxVal) {
        maxVal = prof1D[i];
        maxIdx = i;
      }
    }

    const snr = offStd > 1e-8 ? (maxVal - offMean) / offStd : 0.0;

    // Chi2 against flat hypothesis
    let chi2 = 0;
    if (offVar > 1e-8) {
      for (let i = 0; i < n; i++) {
        const d = prof1D[i] - offMean;
        chi2 += (d * d) / offVar;
      }
    }

    // FWHM estimation (W50)
    const halfMax = offMean + (maxVal - offMean) * 0.5;
    let leftBin = maxIdx;
    while (leftBin > 0 && prof1D[leftBin] > halfMax) leftBin--;
    let rightBin = maxIdx;
    while (rightBin < n - 1 && prof1D[rightBin] > halfMax) rightBin++;
    const fwhmPhase = (rightBin - leftBin) / n;

    return {
      snr: Math.max(0, snr),
      offMean: offMean,
      offStd: offStd,
      maxVal: maxVal,
      chi2: chi2,
      reducedChi2: chi2 / Math.max(1, n - 1),
      fwhmPhase: fwhmPhase
    };
  }

  /**
   * Scans a range of trial DMs to build an SNR vs. DM optimization curve
   */
  function optimizeDm(data, nSamples, nChans, freqsMhz, sampleTimeSec, periodSec, dmMin, dmMax, dmSteps = 25, nBins = 64) {
    const dms = new Float32Array(dmSteps);
    const snrs = new Float32Array(dmSteps);
    const stepSize = (dmMax - dmMin) / (dmSteps - 1);

    let bestDm = dmMin;
    let bestSnr = -1;

    for (let s = 0; s < dmSteps; s++) {
      const trialDm = dmMin + s * stepSize;
      dms[s] = trialDm;

      const dedisp = dedisperse(data, nSamples, nChans, freqsMhz, sampleTimeSec, trialDm);
      const fObj = fold(dedisp, nSamples, nChans, sampleTimeSec, periodSec, nBins, 4, 4);
      const prof1D = get1DProfile(fObj);
      const metrics = calculateSnr(prof1D);

      snrs[s] = metrics.snr;
      if (metrics.snr > bestSnr) {
        bestSnr = metrics.snr;
        bestDm = trialDm;
      }
    }

    return {
      dms: dms,
      snrs: snrs,
      bestDm: bestDm,
      bestSnr: bestSnr
    };
  }

  // --- WEB AUDIO PULSAR SONIFICATION ENGINE ---

  class PulsarAudioEngine {
    constructor() {
      this.ctx = null;
      this.isPlaying = false;
      this.periodSec = 0.089; // Vela default (~11.2 Hz)
      this.dm = 67.97;
      this.sonificationMode = 'dedispersed'; // 'dedispersed' (sharp pulse tone) or 'dispersed' (chirp sweep)
      this.timerId = null;
      this.gainNode = null;
    }

    initAudio() {
      if (this.ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
    }

    start(periodSec, dm, mode = 'dedispersed') {
      this.initAudio();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.periodSec = Math.max(0.002, Math.min(5.0, periodSec));
      this.dm = dm;
      this.sonificationMode = mode;
      if (this.isPlaying) return;

      this.isPlaying = true;
      this.schedulePulsarAudio();
    }

    stop() {
      if (!this.isPlaying) return;
      this.isPlaying = false;
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    }

    schedulePulsarAudio() {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;

      if (this.periodSec < 0.035) {
        // High frequency / Millisecond Pulsar: continuous tone modulated by pulse envelope
        this.playMillisecondTone();
      } else {
        // Low / Mid frequency: distinct periodic pulse scheduling
        this.playPulse(now + 0.01);
        const nextMs = this.periodSec * 1000.0;
        this.timerId = setTimeout(() => this.schedulePulsarAudio(), nextMs);
      }
    }

    playPulse(time) {
      if (!this.ctx || !this.gainNode) return;

      if (this.sonificationMode === 'dispersed') {
        // Chirp sweep: frequency sweep from 1400 Hz down to 400 Hz representing dispersion delay
        const osc = this.ctx.createOscillator();
        const pulseGain = this.ctx.createGain();

        const sweepDuration = Math.min(this.periodSec * 0.8, Math.max(0.04, this.dm * 0.0015));
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200.0, time);
        osc.frequency.exponentialRampToValueAtTime(320.0, time + sweepDuration);

        pulseGain.gain.setValueAtTime(0.7, time);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, time + sweepDuration);

        osc.connect(pulseGain);
        pulseGain.connect(this.gainNode);
        osc.start(time);
        osc.stop(time + sweepDuration);
      } else {
        // Dedispersed: sharp acoustic click / transient punch
        const osc = this.ctx.createOscillator();
        const pulseGain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450.0, time);
        osc.frequency.exponentialRampToValueAtTime(80.0, time + 0.02);

        pulseGain.gain.setValueAtTime(0.85, time);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

        osc.connect(pulseGain);
        pulseGain.connect(this.gainNode);
        osc.start(time);
        osc.stop(time + 0.03);
      }
    }

    playMillisecondTone() {
      if (!this.ctx || !this.gainNode) return;
      // Millisecond pulsar rotational frequency audible as pitch (e.g. 1 / 0.005757 s = 173.7 Hz)
      const rotFreq = 1.0 / this.periodSec;
      const osc = this.ctx.createOscillator();
      const toneGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(rotFreq, this.ctx.currentTime);

      toneGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      osc.connect(toneGain);
      toneGain.connect(this.gainNode);

      osc.start();
      this.currentMsOsc = osc;
      this.currentMsGain = toneGain;

      // Check loop every 200ms
      const checkLoop = () => {
        if (!this.isPlaying) {
          try { osc.stop(); } catch (e) {}
        } else {
          this.timerId = setTimeout(checkLoop, 150);
        }
      };
      checkLoop();
    }
  }

  // Exports
  window.PulsarEngine = {
    K_DM: K_DM,
    calculateDelays: calculateDelays,
    dedisperse: dedisperse,
    fold: fold,
    get1DProfile: get1DProfile,
    getTimePhaseMap: getTimePhaseMap,
    getFreqPhaseMap: getFreqPhaseMap,
    calculateSnr: calculateSnr,
    optimizeDm: optimizeDm,
    PulsarAudioEngine: PulsarAudioEngine
  };

})(typeof window !== 'undefined' ? window : this);
