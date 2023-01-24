import os
import json
import yaml
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Any, Optional
from pulsarfold.core.observation import Observation
from pulsarfold.core.profile import Profile
import pulsarfold

def save_manifest(file_path: str, obs: Observation, profile: Profile, extra_metadata: Optional[Dict[str, Any]] = None):
    """
    Saves a reproducible manifest containing all provenance and metadata.
    """
    manifest = {
        "software": {
            "name": "PulsarFold",
            "version": pulsarfold.__version__ if hasattr(pulsarfold, '__version__') else "unknown"
        },
        "observation": {
            "file_path": obs.file_path,
            "file_hash": obs.file_hash,
            "source_name": obs.source_name,
            "format": obs.file_format,
            "start_time": obs.start_time.isot if obs.start_time is not None else None,
            "duration_sec": obs.duration.to_value('s') if obs.duration is not None else None,
            "center_frequency_mhz": obs.center_frequency.to_value('MHz') if obs.center_frequency is not None else None,
            "bandwidth_mhz": obs.bandwidth.to_value('MHz') if obs.bandwidth is not None else None,
        },
        "results": {
            "dm": profile.dm,
            "period": profile.period,
            "n_bins": profile.n_bins,
            "n_subints": profile.n_subints,
            "n_subbands": profile.n_subbands
        },
        "provenance": profile.provenance
    }
    
    if extra_metadata:
        manifest["extra"] = extra_metadata

    ext = os.path.splitext(file_path)[1].lower()
    with open(file_path, 'w') as f:
        if ext in ['.yaml', '.yml']:
            yaml.dump(manifest, f, default_flow_style=False)
        else:
            json.dump(manifest, f, indent=4)

def export_scientific_figures(output_dir: str, prefix: str, profile: Profile, obs: Observation):
    """
    Exports clean, publication-ready figures for the profile.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. 1D Profile
    plt.figure(figsize=(8, 4))
    prof1d = profile.get_1d_profile()
    phase = np.linspace(0, 1, len(prof1d), endpoint=False)
    # Plot two cycles
    plt.plot(np.concatenate([phase, phase + 1]), np.concatenate([prof1d, prof1d]), 'k-')
    plt.xlabel('Phase')
    plt.ylabel('Intensity')
    plt.title(f'{obs.source_name or "Pulsar"} - P={profile.period:.6f}s, DM={profile.dm:.2f}')
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"{prefix}_profile.pdf"))
    plt.savefig(os.path.join(output_dir, f"{prefix}_profile.png"), dpi=300)
    plt.close()
    
    # 2. Time vs Phase
    time_phase = profile.get_time_phase()
    if time_phase.shape[0] > 1:
        plt.figure(figsize=(8, 6))
        # Two cycles
        tp_2cycle = np.hstack([time_phase, time_phase])
        plt.imshow(tp_2cycle, aspect='auto', interpolation='none', cmap='viridis', 
                   extent=[0, 2, profile.n_subints, 0])
        plt.xlabel('Phase')
        plt.ylabel('Subintegration')
        plt.title('Time vs Phase')
        plt.colorbar(label='Intensity')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, f"{prefix}_time_phase.pdf"))
        plt.savefig(os.path.join(output_dir, f"{prefix}_time_phase.png"), dpi=300)
        plt.close()

    # 3. Freq vs Phase
    freq_phase = profile.get_freq_phase()
    if freq_phase.shape[0] > 1:
        plt.figure(figsize=(8, 6))
        fp_2cycle = np.hstack([freq_phase, freq_phase])
        
        f_start = obs.channel_frequencies[0].value if obs.channel_frequencies is not None else 0
        f_end = obs.channel_frequencies[-1].value if obs.channel_frequencies is not None else profile.n_subbands
        
        plt.imshow(fp_2cycle, aspect='auto', interpolation='none', cmap='viridis', 
                   extent=[0, 2, f_start, f_end])
        plt.xlabel('Phase')
        plt.ylabel('Frequency (MHz)')
        plt.title('Frequency vs Phase')
        plt.colorbar(label='Intensity')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, f"{prefix}_freq_phase.pdf"))
        plt.savefig(os.path.join(output_dir, f"{prefix}_freq_phase.png"), dpi=300)
        plt.close()
        
    # Export array data
    np.savez_compressed(
        os.path.join(output_dir, f"{prefix}_data.npz"),
        profile=profile.data,
        counts=profile.counts,
        period=profile.period,
        dm=profile.dm
    )
