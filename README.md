# PulsarFold (v2.0.0)

[![Deploy GitHub Pages](https://github.com/lorenhey/pulsarfold/actions/workflows/deploy.yml/badge.svg)](https://github.com/lorenhey/pulsarfold/actions/workflows/deploy.yml)
[![Tests Passing](https://img.shields.io/badge/tests-6%2F6%20passed%20(100%25)-00e676.svg)](https://github.com/lorenhey/pulsarfold)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Interactive App](https://img.shields.io/badge/Live%20Workbench-GitHub%20Pages-00e5ff.svg)](https://lorenhey.github.io/pulsarfold/)

**`pulsarfold` es un banco interactivo de astrofísica observacional y procesamiento de señales de radioastronomía:** permite realizar dedispersión incoherente en plasma frío, plegado por épocas (*epoch folding*), optimización metrológica de la Medida de Dispersión ($DM$), análisis de perfiles integrados de pulso y sonificación acústica de estrellas de neutrones en tiempo real.

Disponible en línea sin instalación: **[https://lorenhey.github.io/pulsarfold/](https://lorenhey.github.io/pulsarfold/)**

---

## 🔭 Filosofía y Alcance

`PulsarFold` está diseñado para el análisis riguroso de observaciones de púlsares (desde radiotelescopios pequeños o universitarios hasta datos de grandes observatorios):

- **Astrofísica Transparente y Rigurosa**: Cada cálculo físico (retardo cromático, acumulación en bins de fase, estimación de ruido *off-pulse*) es explícito, reproducible e inspeccionable.
- **Visualización Completa en Falso Color**: Mapas 2D de sub-integraciones temporales vs. fase, espectrogramas dinámicos de frecuencia vs. fase y perfiles integrados unidimensionales $I(\phi)$.
- **Sonificación Acústica Interactiva**: Escuchá el giro del púlsar en Web Audio (pulsos limpios o barridos dispersados *chirp* por el plasma interestelar).
- **Zero-Backend & Offline-First**: Funciona tanto en cliente web (HTML5 / Canvas / SVG / Web Audio) como en suite de procesamiento por lotes en Python (CLI / GUI / API).

---

## 📐 Formulaciones Físicas y Matemáticas

### 1. Retardo por Dispersión en Plasma Frío
Al propagarse por el medio interestelar ionizado (ISM), las frecuencias más bajas viajan a menor velocidad de grupo que las altas. El retardo relativo $\Delta t$ entre la frecuencia observada $\nu$ y la frecuencia de referencia $\nu_{\text{ref}}$ (ambas en $\text{MHz}$) viene dado por:

$$\Delta t = k_{\text{DM}} \times \text{DM} \times \left( \frac{1}{\nu^2} - \frac{1}{\nu_{\text{ref}}^2} \right)$$

donde la constante de dispersión astrofísica es:

$$k_{\text{DM}} = \frac{e^2}{2\pi m_e c} \approx 4.148808 \times 10^3 \quad \left[ \text{MHz}^2 \, \text{pc}^{-1} \, \text{cm}^3 \, \text{s} \right]$$

y la **Medida de Dispersión** ($DM$) es la integral de columna de electrones libres:

$$\text{DM} = \int_0^d n_e(l) \, dl \quad \left[ \text{pc cm}^{-3} \right]$$

### 2. Algoritmo de Plegado por Épocas (Epoch Folding)
Para cada muestra en el tiempo $t$ respecto a la época $t_0$ y período $P$:

$$\phi(t) = \left( \frac{t - t_0}{P} \right) \pmod 1$$

El pulso se discretiza en $N_{\text{bins}}$ celdas de fase. La señal coherente se acumula constructivamente aumentando la relación señal-ruido en proporción a $\sqrt{N_{\text{pulsos}}}$.

### 3. Métricas de Detección (S/N y Chi-Cuadrado Reducido)
El piso de ruido térmico ($\mu_{\text{off}}, \sigma_{\text{off}}$) se determina sobre la región *off-pulse* (75% inferior de los bins ordenados):

$$\text{SNR} = \frac{I_{\max} - \mu_{\text{off}}}{\sigma_{\text{off}}}$$

$$\chi^2_{\text{red}} = \frac{1}{N_{\text{bins}} - 1} \sum_{b=1}^{N_{\text{bins}}} \frac{(I_b - \mu_{\text{off}})^2}{\sigma_{\text{off}}^2}$$

---

## 🌌 Catálogo de Púlsares de Referencia Incluidos

1. **PSR B0531+21 (Crab Pulsar)**:
   - $P = 33.39\ \text{ms}$ (~$30\ \text{Hz}$), $DM = 56.77\ \text{pc cm}^{-3}$.
   - Púlsar joven de la supernova SN 1054 con pulso principal e interpulso prominente.
2. **PSR B0833-45 (Vela Pulsar)**:
   - $P = 89.33\ \text{ms}$ (~$11.2\ \text{Hz}$), $DM = 67.97\ \text{pc cm}^{-3}$.
   - Uno de los púlsares más intensos del cielo austral, caracterizado por un pulso estrecho y gran emisión de alta energía.
3. **PSR J0437-4715 (Púlsar de Milisegundos)**:
   - $P = 5.757\ \text{ms}$ ($173.7\ \text{Hz}$, audible como tono musical en Fa), $DM = 2.64\ \text{pc cm}^{-3}$.
   - El MSP más brillante, reloj cósmico clave para la detección de ondas gravitacionales nanohertz (PTA).
4. **PSR B1919+21 (Jocelyn Bell "LGM-1")**:
   - $P = 1.3373\ \text{s}$, $DM = 12.44\ \text{pc cm}^{-3}$.
   - El primer púlsar descubierto en la historia (1967), célebre por su perfil apilado en la portada de *Unknown Pleasures*.
5. **Transitorio Rápido / FRB de Alto DM**:
   - $P = 250.0\ \text{ms}$, $DM = 180.0\ \text{pc cm}^{-3}$.
   - Curvatura cromática pronunciada para visualizar el alineamiento vertical al dedispersar.

---

## 🚀 Inicio Rápido (Python Core & CLI)

### Instalación
```bash
git clone https://github.com/lorenhey/pulsarfold.git
cd pulsarfold
uv sync
```

### Ejecutar Tests Unitarios
```bash
uv run pytest
```
Salida esperada:
```text
tests\test_basic.py .
tests\test_core_e2e.py .
tests\test_gui.py .
tests\test_synth_pulsar_catalog.py ...
============================== 6 passed in 4.46s ==============================
```

### Interfaz Gráfica de Escritorio (PySide6)
```bash
uv run pulsarfold gui
```

### Procesamiento por Lotes
```bash
uv run pulsarfold batch config.yaml
```

---

## 📜 Licencia

Distribuido bajo la licencia MIT. Consultá `LICENSE` para más información. Desarrollado por **Loren Hey** para astrofísica observacional y procesamiento metrológico de señales de radio.
