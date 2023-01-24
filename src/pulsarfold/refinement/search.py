import numpy as np
import astropy.units as u
from typing import Tuple, Dict, Any, Callable
from pulsarfold.core.observation import Observation
from pulsarfold.dedispersion.incoherent import dedisperse
from pulsarfold.folding.fold import fold
from pulsarfold.metrics.snr import calculate_snr

def refine_parameters(
    obs: Observation, 
    period_center: float, 
    dm_center: float, 
    period_range: float, 
    dm_range: float,
    period_steps: int = 11,
    dm_steps: int = 11,
    n_bins: int = 64,
    metric_func: Callable = calculate_snr
) -> Tuple[float, float, np.ndarray, np.ndarray, np.ndarray]:
    """
    Refine DM and Period by performing a grid search around the center values.
    Returns:
        best_period, best_dm, periods, dms, metric_map
    """
    
    periods = np.linspace(period_center - period_range, period_center + period_range, period_steps)
    dms = np.linspace(dm_center - dm_range, dm_center + dm_range, dm_steps)
    
    metric_map = np.zeros((dm_steps, period_steps))
    
    for i, dm in enumerate(dms):
        # Dedisperse once per DM
        dedisp_obs = dedisperse(obs, dm)
        
        for j, period in enumerate(periods):
            # Fold for each period
            profile = fold(dedisp_obs, period, dm=dm, n_bins=n_bins, n_subints=1, n_subbands=1)
            score = metric_func(profile)
            metric_map[i, j] = score
            
    # Find max
    max_idx = np.unravel_index(np.argmax(metric_map), metric_map.shape)
    best_dm = dms[max_idx[0]]
    best_period = periods[max_idx[1]]
    
    return best_period, best_dm, periods, dms, metric_map
