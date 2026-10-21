/**
 * pulsar-catalog.js - Benchmark catalog of iconic astrophysical pulsars,
 * observation parameters, and realistic synthetic emission profiles.
 * 
 * Part of pulsarfold v2.0.0
 */

(function (window) {
  'use strict';

  const PulsarCatalog = [
    {
      id: 'crab-b0531',
      name: 'PSR B0531+21 (Crab Pulsar)',
      designation: 'J0534+2200 / Nebulosa del Cangrejo (SN 1054)',
      periodSec: 0.033392, // 33.39 ms (~29.95 Hz)
      periodMs: 33.392,
      dmTrue: 56.77,
      fCenterMhz: 1400.0,
      fBandwidthMhz: 128.0,
      nChans: 32,
      nSamples: 2048,
      sampleTimeUs: 128.0, // microseconds
      pulseProfile: {
        components: [
          { phase: 0.22, width: 0.045, amplitude: 1.0 }, // Main Pulse
          { phase: 0.62, width: 0.055, amplitude: 0.55 }  // Interpulse
        ]
      },
      description: 'Púlsar joven en el centro de la Nebulosa del Cangrejo. Presenta la icónica morfología de doble pico (pulso principal e interpulso separados por ~0.4 de fase), emitiendo en radio, óptico, rayos X y gamma.'
    },
    {
      id: 'vela-b0833',
      name: 'PSR B0833-45 (Vela Pulsar)',
      designation: 'J0835-4510 / Remanente de Supernova Vela',
      periodSec: 0.089328, // 89.33 ms (~11.19 Hz)
      periodMs: 89.328,
      dmTrue: 67.97,
      fCenterMhz: 1415.0,
      fBandwidthMhz: 64.0,
      nChans: 32,
      nSamples: 2048,
      sampleTimeUs: 180.0,
      pulseProfile: {
        components: [
          { phase: 0.42, width: 0.038, amplitude: 1.0 }
        ]
      },
      description: 'Uno de los pulsares más brillantes del hemisferio sur. Posee un pulso único y estrecho con elevada emisión de alta energía y frecuentes glitches observacionales en su rotación.'
    },
    {
      id: 'j0437-4715',
      name: 'PSR J0437-4715 (Púlsar de Milisegundo)',
      designation: 'Flagship Millisecond Pulsar (PTA Reloj Cósmico)',
      periodSec: 0.005757, // 5.757 ms (~173.7 Hz)
      periodMs: 5.757,
      dmTrue: 2.64,
      fCenterMhz: 1400.0,
      fBandwidthMhz: 128.0,
      nChans: 32,
      nSamples: 2048,
      sampleTimeUs: 25.0,
      pulseProfile: {
        components: [
          { phase: 0.50, width: 0.06, amplitude: 1.0 },
          { phase: 0.65, width: 0.08, amplitude: 0.25 }
        ]
      },
      description: 'El púlsar de milisegundos más cercano y brillante. Rota 173.7 veces por segundo (audible como tono musical) y es un pilar fundamental en arreglos de temporización (PTA) para la detección de ondas gravitacionales nanohertz.'
    },
    {
      id: 'b1919-21',
      name: 'PSR B1919+21 (Jocelyn Bell "LGM-1")',
      designation: 'Primer Púlsar Descubierto (1967, Cambridge)',
      periodSec: 1.3373, // 1.337 s
      periodMs: 1337.3,
      dmTrue: 12.44,
      fCenterMhz: 408.0,
      fBandwidthMhz: 16.0,
      nChans: 32,
      nSamples: 2048,
      sampleTimeUs: 2500.0,
      pulseProfile: {
        components: [
          { phase: 0.35, width: 0.04, amplitude: 1.0 }
        ]
      },
      description: 'El histórico pulsar que inauguró la radioastronomía de pulsares en 1967. Famoso por su gráfico de pulsos sucesivos apilados que ilustró el disco "Unknown Pleasures" de Joy Division.'
    },
    {
      id: 'frb-high-dm',
      name: 'Transitorio Rápido / Púlsar de Alto DM',
      designation: 'Candidate Synthetic Fast Sweep (ISM Profundo)',
      periodSec: 0.250, // 250 ms
      periodMs: 250.0,
      dmTrue: 180.0,
      fCenterMhz: 1400.0,
      fBandwidthMhz: 256.0,
      nChans: 32,
      nSamples: 2048,
      sampleTimeUs: 400.0,
      pulseProfile: {
        components: [
          { phase: 0.50, width: 0.035, amplitude: 1.0 }
        ]
      },
      description: 'Simulación didáctica de un transitorio de alta dispersión interestelar (DM = 180.0 pc cm^-3). Evidencia la curvatura hiperbólica en el espectro dinámico que se rectifica verticalmente al aplicar dedispersión exacta.'
    }
  ];

  window.PulsarCatalog = PulsarCatalog;
})(typeof window !== 'undefined' ? window : this);
