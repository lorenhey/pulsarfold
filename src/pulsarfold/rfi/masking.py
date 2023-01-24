import numpy as np
from pulsarfold.core.observation import Observation
import copy

def calculate_channel_stats(obs: Observation) -> np.ndarray:
    """Returns standard deviation of each channel."""
    if obs.data is None:
        raise ValueError("No data")
    return np.std(obs.data, axis=0)

def calculate_time_stats(obs: Observation) -> np.ndarray:
    """Returns standard deviation of each time sample (across channels)."""
    if obs.data is None:
        raise ValueError("No data")
    return np.std(obs.data, axis=1)

def build_mad_mask(data: np.ndarray, threshold: float = 3.0, axis: int = 0) -> np.ndarray:
    """
    Builds a boolean mask where True indicates an outlier based on MAD.
    """
    median = np.median(data, axis=axis, keepdims=True)
    mad = np.median(np.abs(data - median), axis=axis, keepdims=True)
    
    # Avoid division by zero
    mad = np.where(mad == 0, 1e-10, mad)
    
    z_score = np.abs(data - median) / (1.4826 * mad)
    
    # The mask is True where the z_score > threshold
    return (z_score > threshold).astype(bool)

def apply_rfi_mask(obs: Observation, mask: np.ndarray) -> Observation:
    """
    Returns a new observation with the RFI mask applied (logical OR with existing mask).
    """
    new_obs = copy.copy(obs)
    if new_obs.rfi_mask is None:
        new_obs.rfi_mask = mask
    else:
        new_obs.rfi_mask = new_obs.rfi_mask | mask
        
    new_obs.add_history("apply_rfi_mask", {"mask_shape": mask.shape})
    return new_obs

def automatic_masking(obs: Observation, chan_thresh: float = 3.0, time_thresh: float = 3.0) -> Observation:
    """
    Applies automatic RFI masking based on channel and time statistics using MAD.
    """
    if obs.data is None:
        raise ValueError("No data")
        
    # Mask entire channels that are anomalously noisy
    chan_stds = np.std(obs.data, axis=0)
    chan_median = np.median(chan_stds)
    chan_mad = np.median(np.abs(chan_stds - chan_median))
    if chan_mad == 0: chan_mad = 1e-10
    bad_chans = (np.abs(chan_stds - chan_median) / (1.4826 * chan_mad)) > chan_thresh
    
    # Mask entire time samples that are anomalously noisy
    time_stds = np.std(obs.data, axis=1)
    time_median = np.median(time_stds)
    time_mad = np.median(np.abs(time_stds - time_median))
    if time_mad == 0: time_mad = 1e-10
    bad_times = (np.abs(time_stds - time_median) / (1.4826 * time_mad)) > time_thresh
    
    # Combine into a full shape mask
    mask = np.zeros(obs.get_data_shape(), dtype=bool)
    mask[:, bad_chans] = True
    mask[bad_times, :] = True
    
    return apply_rfi_mask(obs, mask)
