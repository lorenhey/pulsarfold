import numpy as np
from pulsarfold.core.profile import Profile

def calculate_snr(profile: Profile) -> float:
    """
    Calculate the Signal-to-Noise Ratio (S/N) of a 1D profile.
    Uses the RMS of the off-pulse region (estimated from the lowest 75% of bins)
    """
    prof_1d = profile.get_1d_profile()
    if np.all(prof_1d == 0) or np.all(np.isnan(prof_1d)):
        return 0.0
        
    # Estimate off-pulse by taking the lowest 75% of the profile
    sorted_prof = np.sort(prof_1d)
    n_off = max(int(len(sorted_prof) * 0.75), 1)
    off_pulse = sorted_prof[:n_off]
    
    mean_val = np.mean(off_pulse)
    std_val = np.std(off_pulse)
    
    if std_val == 0:
        return 0.0
        
    max_val = np.max(prof_1d)
    return (max_val - mean_val) / std_val

def calculate_chi2(profile: Profile) -> float:
    """
    Calculate the chi-squared statistic assuming a flat profile (null hypothesis).
    We use the off-pulse variance to estimate the noise variance.
    """
    prof_1d = profile.get_1d_profile()
    if np.all(prof_1d == 0) or np.all(np.isnan(prof_1d)):
        return 0.0
        
    sorted_prof = np.sort(prof_1d)
    n_off = max(int(len(sorted_prof) * 0.75), 1)
    off_pulse = sorted_prof[:n_off]
    
    mean_val = np.mean(off_pulse)
    variance = np.var(off_pulse)
    
    if variance == 0:
        return 0.0
        
    chi2 = np.sum((prof_1d - mean_val)**2) / variance
    return chi2
