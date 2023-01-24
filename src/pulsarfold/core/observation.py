from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
from astropy.time import Time
from astropy.coordinates import SkyCoord, EarthLocation
import astropy.units as u

@dataclass
class Observation:
    """
    Central representation of a pulsar observation.
    All unknown fields should remain None rather than populated with magic numbers.
    """
    # Origin and Identification
    source_name: Optional[str] = None
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    file_format: Optional[str] = None

    # Time domain
    start_time: Optional[Time] = None  # MJD or full Time object
    sample_time: Optional[u.Quantity] = None  # e.g., in seconds
    n_samples: Optional[int] = None
    duration: Optional[u.Quantity] = None # n_samples * sample_time if both exist

    # Frequency domain
    center_frequency: Optional[u.Quantity] = None # e.g., in MHz
    bandwidth: Optional[u.Quantity] = None # e.g., in MHz
    n_channels: Optional[int] = None
    channel_frequencies: Optional[u.Quantity] = None # Array of frequencies

    # Other metadata
    polarizations: Optional[List[str]] = None
    source_coords: Optional[SkyCoord] = None
    observatory: Optional[EarthLocation] = None
    
    # Data and Masks
    # We use a memory-mapped or chunked representation for data, but for now we hold a reference
    # or keep the array if it's small enough.
    data: Optional[np.ndarray] = None  # shape (n_samples, n_channels) or (n_samples, n_channels, n_pols)
    rfi_mask: Optional[np.ndarray] = None # Boolean mask, True means RFI

    # Provenance and History
    provenance: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        # Calculate derived quantities if possible
        if self.duration is None and self.n_samples is not None and self.sample_time is not None:
            self.duration = self.n_samples * self.sample_time
        
        # If channel_frequencies is missing but n_channels, bandwidth, center_freq are there
        if self.channel_frequencies is None and all(v is not None for v in [self.n_channels, self.bandwidth, self.center_frequency]):
            # Typical convention: channels evenly spaced across bandwidth.
            # Depending on if it's high-to-low or low-to-high, we might need a channel bandwidth sign.
            # We assume simple linear spacing for now.
            df = self.bandwidth / self.n_channels
            # frequencies at the center of each channel
            start_f = self.center_frequency - self.bandwidth / 2 + df / 2
            self.channel_frequencies = start_f + np.arange(self.n_channels) * df

    def get_data_shape(self) -> Tuple[int, ...]:
        """Returns the shape of the data array, or expected shape from metadata if data is None"""
        if self.data is not None:
            return self.data.shape
        shape = []
        if self.n_samples: shape.append(self.n_samples)
        if self.n_channels: shape.append(self.n_channels)
        if self.polarizations and len(self.polarizations) > 1: shape.append(len(self.polarizations))
        return tuple(shape)
    
    def add_history(self, action: str, parameters: Dict[str, Any]):
        from datetime import datetime, timezone
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "parameters": parameters
        }
        self.provenance.append(entry)

    @classmethod
    def load(cls, file_path: str, file_format: str = 'auto') -> 'Observation':
        """
        Load an observation. Dispatch to correct adapter based on format or extension.
        """
        from pulsarfold.io.dispatch import load_observation
        return load_observation(file_path, file_format)
        
    def dedisperse(self, dm: float, ref_freq: Optional[u.Quantity] = None) -> 'Observation':
        """Incoherently dedisperse the observation."""
        from pulsarfold.dedispersion.incoherent import dedisperse as _dedisperse
        return _dedisperse(self, dm, ref_freq)
        
    def auto_mask(self, chan_thresh: float = 3.0, time_thresh: float = 3.0) -> 'Observation':
        """Apply automatic RFI masking."""
        from pulsarfold.rfi.masking import automatic_masking
        return automatic_masking(self, chan_thresh, time_thresh)
        
    def apply_mask(self, mask: np.ndarray) -> 'Observation':
        """Apply a manual RFI mask."""
        from pulsarfold.rfi.masking import apply_rfi_mask
        return apply_rfi_mask(self, mask)
        
    def fold(self, period: float, dm: float = 0.0, n_bins: int = 256, n_subints: int = 1, n_subbands: int = 1):
        """Fold the observation into a Profile."""
        from pulsarfold.folding.fold import fold as _fold
        return _fold(self, period, dm=dm, n_bins=n_bins, n_subints=n_subints, n_subbands=n_subbands)

