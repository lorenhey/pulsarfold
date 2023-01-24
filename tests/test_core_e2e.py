import numpy as np
import pytest
from pulsarfold.io.synthetic import generate_synthetic_pulsar
from pulsarfold.metrics.snr import calculate_snr, calculate_chi2
from pulsarfold.refinement.search import refine_parameters

def test_end_to_end_synthetic():
    # 1. Generate synthetic pulsar
    obs = generate_synthetic_pulsar(
        duration=5.0, 
        period=0.1, 
        dm=50.0, 
        snr_per_pulse=2.0,
        fch1=400.0
    )
    
    assert obs.n_samples == 5000
    assert obs.n_channels == 64
    
    # Add some RFI
    obs.data[100, :] = 100.0  # Time domain impulse
    obs.data[:, 10] = 100.0   # Frequency channel RFI
    
    # 2. Mask RFI
    masked_obs = obs.auto_mask(chan_thresh=5.0, time_thresh=5.0)
    assert masked_obs.rfi_mask[100, 0] == True
    assert masked_obs.rfi_mask[0, 10] == True
    
    # 3. Dedisperse
    dedisp_obs = masked_obs.dedisperse(dm=50.0)
    
    # 4. Fold
    profile = dedisp_obs.fold(period=0.1, n_bins=32, n_subints=4, n_subbands=4)
    
    assert profile.data.shape == (4, 4, 32)
    
    # 5. Check SNR
    snr = calculate_snr(profile)
    assert snr > 2.5 # Should be easily detectable
    
    # Check Chi2
    chi2 = calculate_chi2(profile)
    assert chi2 > 10.0
    
    # 6. Refinement search
    best_p, best_dm, periods, dms, metric_map = refine_parameters(
        masked_obs, 
        period_center=0.1, 
        dm_center=50.0, 
        period_range=0.01, 
        dm_range=10.0,
        period_steps=21,
        dm_steps=21,
        n_bins=16
    )
    
    assert np.isclose(best_p, 0.1, atol=0.005)
    assert np.isclose(best_dm, 50.0, atol=5.0)
