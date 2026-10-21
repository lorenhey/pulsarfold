/**
 * pulsar-cli.js - In-browser CLI emulator for pulsarfold commands.
 * 
 * Part of pulsarfold v2.0.0
 */

(function (window) {
  'use strict';

  function initCli(terminalElement, inputElement, appInstance) {
    if (!terminalElement || !inputElement) return;

    const history = [];
    let historyIdx = -1;

    function println(text, cssClass = '') {
      const line = document.createElement('div');
      line.className = 'cli-line ' + cssClass;
      line.textContent = text;
      terminalElement.appendChild(line);
      terminalElement.scrollTop = terminalElement.scrollHeight;
    }

    // Welcome banner
    println('====================================================================', 'cli-accent');
    println('  PulsarFold v2.0.0 - Banco Astrofísico de Plegado y Dedispersión   ', 'cli-accent');
    println('  Escribí "help" para ver los comandos disponibles o "catalog".     ', 'cli-dim');
    println('====================================================================', 'cli-accent');

    function executeCommand(cmdStr) {
      const raw = cmdStr.trim();
      if (!raw) return;

      history.push(raw);
      historyIdx = history.length;

      println('pulsarfold:~$ ' + raw, 'cli-prompt');

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case 'help':
          println('Comandos disponibles:');
          println('  catalog                     Lista los pulsares y candidatos del catálogo.');
          println('  load <id>                   Carga un púlsar en el banco de trabajo.');
          println('  dm <val>                    Ajusta el DM de ensayo (pc cm^-3) y repliega.');
          println('  period <ms>                 Ajusta el período de plegado en milisegundos.');
          println('  optimize                    Escanea DMs de ensayo para maximizar la S/N.');
          println('  play [dedispersed|dispersed] Sonificación del púlsar en Web Audio.');
          println('  stop                        Detiene la sonificación.');
          println('  snr                         Muestra la relación señal-ruido y chi-cuadrado.');
          println('  summary                     Resumen astrofísico del perfil integrado.');
          println('  report                      Genera reporte de auditoría en Markdown.');
          println('  clear                       Limpia la terminal.');
          break;

        case 'clear':
          terminalElement.innerHTML = '';
          break;

        case 'catalog':
          println('Catálogo de Pulsares de Referencia:');
          window.PulsarCatalog.forEach(p => {
            println(`  • ${p.id.padEnd(16)} ${p.name.padEnd(30)} P: ${p.periodMs.toFixed(3)} ms | DM: ${p.dmTrue} pc/cm³`);
          });
          break;

        case 'load':
          if (args.length === 0) {
            println('Uso: load <pulsar-id>. Escribí "catalog" para ver los IDs.', 'cli-warn');
          } else {
            const id = args[0].toLowerCase();
            const found = window.PulsarCatalog.find(p => p.id.toLowerCase() === id);
            if (found) {
              appInstance.loadPulsar(found.id);
              println(`✓ Púlsar cargado: ${found.name} (P = ${found.periodMs.toFixed(3)} ms, DM = ${found.dmTrue} pc/cm³)`, 'cli-success');
            } else {
              println(`Púlsar no encontrado: "${id}".`, 'cli-error');
            }
          }
          break;

        case 'dm':
          if (args.length === 0) {
            println(`DM actual: ${appInstance.trialDm.toFixed(2)} pc/cm³ (DM real: ${appInstance.currentPulsar.dmTrue} pc/cm³)`);
          } else {
            const val = parseFloat(args[0]);
            if (!isNaN(val) && val >= 0) {
              appInstance.setDm(val);
              println(`✓ DM ajustado a ${val.toFixed(2)} pc/cm³ (S/N: ${appInstance.currentMetrics.snr.toFixed(1)})`, 'cli-success');
            } else {
              println('El valor de DM debe ser un número positivo.', 'cli-error');
            }
          }
          break;

        case 'period':
          if (args.length === 0) {
            println(`Período actual: ${(appInstance.trialPeriodSec * 1000).toFixed(3)} ms`);
          } else {
            const valMs = parseFloat(args[0]);
            if (!isNaN(valMs) && valMs > 0) {
              appInstance.setPeriodMs(valMs);
              println(`✓ Período ajustado a ${valMs.toFixed(3)} ms`, 'cli-success');
            } else {
              println('El período debe ser mayor a 0 ms.', 'cli-error');
            }
          }
          break;

        case 'optimize':
          println('Escaneando espacio de parámetros DM...');
          appInstance.runDmOptimization();
          println(`✓ DM óptimo hallado: ${appInstance.optResult.bestDm.toFixed(2)} pc/cm³ (S/N máx: ${appInstance.optResult.bestSnr.toFixed(1)})`, 'cli-success');
          break;

        case 'play':
          {
            const mode = args[0] && args[0].toLowerCase() === 'dispersed' ? 'dispersed' : 'dedispersed';
            appInstance.playAudio(mode);
            println(`▶ Reproduciendo sonificación acústica [Modo: ${mode}]`, 'cli-success');
          }
          break;

        case 'stop':
          appInstance.stopAudio();
          println('■ Sonificación detenida.', 'cli-dim');
          break;

        case 'snr':
          {
            const m = appInstance.currentMetrics;
            println('--- Métricas de Detección ---', 'cli-accent');
            println(`  Relación Señal-Ruido (S/N):  ${m.snr.toFixed(2)} σ`);
            println(`  Chi-Cuadrado Reducido:       ${m.reducedChi2.toFixed(2)}`);
            println(`  Ancho de Pulso (W50 / FWHM): ${(m.fwhmPhase * 100).toFixed(1)}% de fase`);
            println(`  Piso de Ruido (Off-pulse σ): ${m.offStd.toFixed(4)}`);
          }
          break;

        case 'summary':
          {
            const s = appInstance.getSummary();
            println('--- Resumen Astrofísico ---', 'cli-accent');
            println(`  Púlsar:           ${s.name}`);
            println(`  Designación:      ${s.designation}`);
            println(`  Período P:        ${s.periodMs.toFixed(3)} ms (Frecuencia: ${s.freqHz.toFixed(2)} Hz)`);
            println(`  Medida Dispersión: ${s.trialDm.toFixed(2)} pc/cm³ (Real: ${s.dmTrue.toFixed(2)})`);
            println(`  Detección S/N:    ${s.snr.toFixed(1)} σ (χ²_red: ${s.reducedChi2.toFixed(1)})`);
            println(`  Ancho W50:        ${(s.fwhmPhase * 100).toFixed(1)}% de fase`);
          }
          break;

        case 'report':
          println(appInstance.generateMarkdownReport());
          break;

        default:
          println(`Comando no reconocido: "${cmd}". Escribí "help" para ver los comandos.`, 'cli-error');
          break;
      }
    }

    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = inputElement.value;
        inputElement.value = '';
        executeCommand(val);
      } else if (e.key === 'ArrowUp') {
        if (history.length > 0 && historyIdx > 0) {
          historyIdx--;
          inputElement.value = history[historyIdx];
        }
      } else if (e.key === 'ArrowDown') {
        if (historyIdx < history.length - 1) {
          historyIdx++;
          inputElement.value = history[historyIdx];
        } else {
          historyIdx = history.length;
          inputElement.value = '';
        }
      }
    });
  }

  window.PulsarCli = { init: initCli };
})(typeof window !== 'undefined' ? window : this);
