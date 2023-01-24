import numpy as np
import astropy.units as u
from astropy.time import Time
from pulsarfold.core.observation import Observation

def generate_synthetic_pulsar(
    duration: float = 10.0,
    sample_time: float = 0.001,
    n_channels: int = 64,
    fch1: float = 1500.0,
    foff: float = -1.0,
    period: float = 0.1,
    dm: float = 50.0,
    snr_per_pulse: float = 5.0,
    pulse_width_phase: float = 0.05
) -> Observation:
    """
    Generates a synthetic pulsar observation with specified parameters.
    """
    n_samples = int(duration / sample_time)
    
    # Generate frequencies
    freqs = fch1 + np.arange(n_channels) * foff
    
    # Calculate time delays due to DM
    # Dispersion constant: 4.148808e3 MHz^2 pc^-1 cm^3 s
    k_dm = 4.148808e3
    
    # Reference frequency is usually the highest frequency for delay = 0
    f_ref = np.max(freqs)
    
    delays = k_dm * dm * (1.0 / freqs**2 - 1.0 / f_ref**2)
    delay_bins = (delays / sample_time).astype(int)
    
    # Create pure noise
    data = np.random.normal(0, 1, size=(n_samples, n_channels)).astype(np.float32)
    
    # Create the pulse profile
    phase = np.linspace(0, 1, int(period / sample_time), endpoint=False)
    # Gaussian pulse centered at phase 0.5
    profile = np.exp(-0.5 * ((phase - 0.5) / pulse_width_phase)**2)
    profile /= np.max(profile)
    
    # Inject pulses
    for i in range(n_channels):
        # Shift the pulse train by the DM delay for this channel
        shift = delay_bins[i]
        
        # We need a continuous pulse train
        pulse_train = np.tile(profile, int(np.ceil(n_samples / len(profile))))[:n_samples]
        
        # Apply shift (roll)
        shifted_train = np.roll(pulse_train, shift)
        
        # Scale to desired SNR approx
        scaled_train = shifted_train * snr_per_pulse
        
        data[:, i] += scaled_train
        
    # Build the Observation
    obs = Observation(
        source_name="Synthetic_Pulsar",
        file_path="synthetic_data",
        file_format="synthetic",
        start_time=Time(59000.0, format='mjd'),
        sample_time=sample_time * u.s,
        n_samples=n_samples,
        n_channels=n_channels,
        center_frequency=(fch1 + foff * n_channels / 2) * u.MHz,
        bandwidth=np.abs(foff) * n_channels * u.MHz,
        channel_frequencies=freqs * u.MHz,
        data=data
    )
    obs.add_history("generate_synthetic", {
        "duration": duration, "period": period, "dm": dm, "snr": snr_per_pulse
    })
    
    return obs
