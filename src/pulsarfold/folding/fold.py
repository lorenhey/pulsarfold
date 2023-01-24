import numpy as np
import astropy.units as u
from pulsarfold.core.observation import Observation
from pulsarfold.core.profile import Profile

def fold(obs: Observation, period: float, dm: float = 0.0, n_bins: int = 256, n_subints: int = 1, n_subbands: int = 1) -> Profile:
    """
    Fold an observation into a Profile.
    
    If dm > 0 and observation is not dedispersed, it should be dedispersed first, 
    but for this function we assume obs is already dedispersed if dm was given to prior steps.
    Actually, to keep it clean, we just fold what we are given. `dm` parameter here is just for metadata.
    """
    if obs.data is None:
        raise ValueError("Observation has no data.")
    if obs.sample_time is None:
        raise ValueError("Observation is missing sample time.")
        
    tsamp = obs.sample_time.to_value(u.s)
    n_samples = obs.n_samples
    n_channels = obs.n_channels
    
    # Calculate phase for each sample
    # phase = (t - epoch) / period % 1
    # For now, epoch = 0 relative to start_time
    times = np.arange(n_samples) * tsamp
    phases = (times / period) % 1.0
    phase_bins = (phases * n_bins).astype(int)
    
    # We want to fold into (n_subints, n_subbands, n_bins)
    folded_data = np.zeros((n_subints, n_subbands, n_bins), dtype=np.float64)
    counts = np.zeros((n_subints, n_subbands, n_bins), dtype=np.int32)
    
    # Mask handling
    if obs.rfi_mask is not None:
        valid_data = ~obs.rfi_mask
    else:
        valid_data = np.ones((n_samples, n_channels), dtype=bool)

    # Subintegration and subband boundaries
    samples_per_subint = n_samples // n_subints
    chans_per_subband = n_channels // n_subbands
    
    # To avoid slow pure Python loops, we can use numpy indexing or numba. 
    # For a simple, reasonably fast numpy approach without numba:
    # We can iterate over subints and subbands.
    
    for i in range(n_subints):
        start_samp = i * samples_per_subint
        # Ensure the last subint takes the remainder
        end_samp = (i + 1) * samples_per_subint if i < n_subints - 1 else n_samples
        
        subint_phases = phase_bins[start_samp:end_samp]
        
        for j in range(n_subbands):
            start_chan = j * chans_per_subband
            end_chan = (j + 1) * chans_per_subband if j < n_subbands - 1 else n_channels
            
            # Slice data and mask
            sub_data = obs.data[start_samp:end_samp, start_chan:end_chan]
            sub_mask = valid_data[start_samp:end_samp, start_chan:end_chan]
            
            # Sum over channels within the subband first
            # But wait, we need to add to the correct phase bin.
            # A sample at time t applies to ALL channels at time t.
            # So we can sum the valid channels for each time sample.
            
            # shape of sub_data: (n_samples_subint, n_chans_subband)
            valid_sub_data = sub_data * sub_mask
            
            summed_sub_data = np.sum(valid_sub_data, axis=1) # (n_samples_subint,)
            summed_counts = np.sum(sub_mask, axis=1)         # (n_samples_subint,)
            
            # Now accumulate into phase bins using bincount
            folded_data[i, j, :] = np.bincount(subint_phases, weights=summed_sub_data, minlength=n_bins)[:n_bins]
            counts[i, j, :] = np.bincount(subint_phases, weights=summed_counts, minlength=n_bins)[:n_bins]

    profile = Profile(
        data=folded_data,
        counts=counts,
        n_bins=n_bins,
        period=period,
        dm=dm,
        start_time=obs.start_time,
        n_subints=n_subints,
        n_subbands=n_subbands,
        source_name=obs.source_name
    )
    
    profile.provenance = list(obs.provenance) # copy history
    profile.provenance.append({
        "action": "fold",
        "parameters": {"period": period, "n_bins": n_bins, "n_subints": n_subints, "n_subbands": n_subbands}
    })
    
    return profile
