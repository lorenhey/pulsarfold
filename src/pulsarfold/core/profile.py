from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
import numpy as np
from astropy.time import Time
import astropy.units as u

@dataclass
class Profile:
    """
    Represents a folded pulsar profile.
    Can be 1D (phase), 2D (time vs phase, or freq vs phase), or 3D (time vs freq vs phase).
    """
    data: np.ndarray  # The folded data
    counts: np.ndarray  # Number of samples accumulated in each bin
    
    n_bins: int
    period: float  # The period used for folding
    dm: float      # The DM used for dedispersion
    
    start_time: Optional[Time] = None
    epoch: Optional[Time] = None
    
    # Metadata about dimensions if > 1D
    n_subints: int = 1
    n_subbands: int = 1
    
    # Information about the source
    source_name: Optional[str] = None
    
    provenance: List[Dict[str, Any]] = field(default_factory=list)
    
    def get_1d_profile(self) -> np.ndarray:
        """Collapse to a 1D profile across time and frequency."""
        # Sum data and counts over all axes except the last one (phase)
        axes_to_sum = tuple(range(self.data.ndim - 1))
        sum_data = np.sum(self.data, axis=axes_to_sum)
        sum_counts = np.sum(self.counts, axis=axes_to_sum)
        
        # Avoid division by zero
        with np.errstate(divide='ignore', invalid='ignore'):
            prof = sum_data / sum_counts
            
        # Replace NaNs (where count was 0) with 0
        prof = np.nan_to_num(prof)
        return prof
        
    def get_time_phase(self) -> np.ndarray:
        """Collapse frequency to get a 2D Time vs Phase array."""
        if self.data.ndim == 3: # (subints, subbands, phase)
            sum_data = np.sum(self.data, axis=1)
            sum_counts = np.sum(self.counts, axis=1)
            with np.errstate(divide='ignore', invalid='ignore'):
                return np.nan_to_num(sum_data / sum_counts)
        elif self.data.ndim == 2: # Assuming (subints, phase)
            with np.errstate(divide='ignore', invalid='ignore'):
                return np.nan_to_num(self.data / self.counts)
        else:
            return self.get_1d_profile().reshape(1, -1)

    def get_freq_phase(self) -> np.ndarray:
        """Collapse time to get a 2D Freq vs Phase array."""
        if self.data.ndim == 3: # (subints, subbands, phase)
            sum_data = np.sum(self.data, axis=0)
            sum_counts = np.sum(self.counts, axis=0)
            with np.errstate(divide='ignore', invalid='ignore'):
                return np.nan_to_num(sum_data / sum_counts)
        else:
            raise ValueError("Data does not have subbands dimension.")
