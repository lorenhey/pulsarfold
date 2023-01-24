# PulsarFold

PulsarFold is a compact workbench for pulsar observation analysis.

It is designed for one specific workflow: taking a single radio observation of a pulsar (such as from a small radio telescope or experimental setup) and interactively guiding the user through data ingestion, quality control, RFI masking, dedispersion, folding, parameter refinement, and reproducible export.

**What PulsarFold is:**
* A transparent, visual tool for analyzing known pulsars or simple candidates.
* A scientific workbench where every operation is reversible and inspectable.
* A tool that prioritizes correct physics and explicit metadata. Unknown values are never silently guessed.
* A producer of reproducible, publication-ready results with detailed manifests.

**What PulsarFold is NOT:**
* A complete blind search pipeline.
* A replacement for PRESTO, DSPSR, or PSRCHIVE.
* A pulsar timing package (like PINT or TEMPO).
* A tool for baseband or raw voltage processing.

## Installation

Ensure you have Python 3.12+ installed.

```bash
pip install pulsarfold
```

For development:
```bash
git clone https://github.com/lorenhey/pulsarfold.git
cd pulsarfold
pip install -e ".[dev]"
```

## Usage

### Interactive GUI

The primary way to use PulsarFold is through its GUI:

```bash
pulsarfold gui
```

Or open a specific file directly:
```bash
pulsarfold gui observation.fil
```

### CLI Batch Processing

To process an observation non-interactively using a YAML config file:

```bash
pulsarfold batch config.yaml
```

Example `config.yaml`:
```yaml
jobs:
  - input: "observation.fil"
    rfi_auto: true
    dm: 50.0
    period: 0.1
    n_bins: 128
    output_dir: "results"
    prefix: "obs1"
```

### Python API

PulsarFold can be used as a Python library:

```python
from pulsarfold.core.observation import Observation

# Load data
obs = Observation.load("observation.fil")

# Chain operations
profile = (
    obs
    .auto_mask(chan_thresh=5.0, time_thresh=5.0)
    .dedisperse(dm=50.0)
    .fold(period=0.1, n_bins=128)
)

# Export
from pulsarfold.export.save import export_scientific_figures, save_manifest
export_scientific_figures("out", "test", profile, obs)
save_manifest("out/manifest.yaml", obs, profile)
```

## Scientific Workflow

1. **Ingestion**: Reads SIGPROC Filterbank (`.fil`) formats. Uses memory mapping for efficiency.
2. **RFI Masking**: Automatically flags anomalous channels and time samples using Median Absolute Deviation (MAD). 
3. **Dedispersion**: Incoherent dedispersion using standard dispersion measure delays.
4. **Folding**: Folds the time series at the specified period into sub-integrations and sub-bands.
5. **Validation**: Visualizes the 1D pulse profile, Phase vs Time, and Phase vs Frequency.
6. **Reproducibility**: Exports the folded arrays along with a YAML manifest detailing all operations.

## Architecture

PulsarFold strictly separates the scientific core from the GUI. The core operations (dedispersion, folding, etc.) manipulate an immutable-like `Observation` model, ensuring that operations can be chained safely and reproduced perfectly from scripts.

## License
MIT
