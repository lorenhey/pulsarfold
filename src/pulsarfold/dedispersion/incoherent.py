import numpy as np
import astropy.units as u
from pulsarfold.core.observation import Observation

# Dispersion constant (MHz^2 pc^-1 cm^3 s)
K_DM = 4.148808e3

def calculate_delays(freqs: u.Quantity, dm: float, ref_freq: u.Quantity = None) -> np.ndarray:
    """
    Calculate the time delays in seconds for a given DM and frequencies.
    """
    freqs_mhz = freqs.to_value(u.MHz)
    if ref_freq is None:
        ref_freq_mhz = np.max(freqs_mhz)
    else:
        ref_freq_mhz = ref_freq.to_value(u.MHz)
        
    delays = K_DM * dm * (1.0 / freqs_mhz**2 - 1.0 / ref_freq_mhz**2)
    return delays

def dedisperse(obs: Observation, dm: float, ref_freq: u.Quantity = None) -> Observation:
    """
    Incoherently dedisperse an observation.
    Returns a new Observation object with the dedispersed data.
    """
    if obs.data is None:
        raise ValueError("Observation has no data to dedisperse.")
    if obs.channel_frequencies is None:
        raise ValueError("Observation is missing channel frequencies.")
    if obs.sample_time is None:
        raise ValueError("Observation is missing sample time.")
        
    delays_sec = calculate_delays(obs.channel_frequencies, dm, ref_freq)
    sample_time_sec = obs.sample_time.to_value(u.s)
    
    # Calculate shift in bins (round to nearest integer)
    shift_bins = np.round(delays_sec / sample_time_sec).astype(int)
    
    # Allocate new array
    # If the array is very large, rolling in memory could be an issue, but we'll stick to memory for now.
    new_data = np.zeros_like(obs.data)
    
    for i in range(obs.n_channels):
        # We want to remove the delay, so we shift backwards (negative roll)
        shift = -shift_bins[i]
        new_data[:, i] = np.roll(obs.data[:, i], shift)
        
    import copy
    new_obs = copy.copy(obs)
    new_obs.data = new_data
    
    # Also roll the mask if it exists
    if obs.rfi_mask is not None:
        new_mask = np.zeros_like(obs.rfi_mask)
        for i in range(obs.n_channels):
            new_mask[:, i] = np.roll(obs.rfi_mask[:, i], -shift_bins[i])
        new_obs.rfi_mask = new_mask
        
    new_obs.add_history("dedisperse", {"dm": dm, "ref_freq": ref_freq.to_string() if ref_freq else None})
    return new_obs
