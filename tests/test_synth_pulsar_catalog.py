import pytest
import numpy as np
import astropy.units as u
from pulsarfold.dedispersion.incoherent import calculate_delays, K_DM
from pulsarfold.metrics.snr import calculate_snr
from pulsarfold.core.profile import Profile

def test_dispersion_delays_exact():
    # Cold plasma dispersion formula: dt = K_DM * DM * (nu1^-2 - nu2^-2)
    freqs = np.array([1400.0, 1600.0]) * u.MHz
    dm = 50.0 # pc cm^-3
    
    delays = calculate_delays(freqs, dm, ref_freq=1600.0 * u.MHz)
    # At ref_freq (1600 MHz), delay should be 0.0
    assert np.isclose(delays[1], 0.0, atol=1e-7)
    
    # At 1400 MHz, delay = 4.148808e3 * 50 * (1/1400^2 - 1/1600^2)
    expected_delay = K_DM * dm * (1.0 / (1400.0**2) - 1.0 / (1600.0**2))
    assert np.isclose(delays[0], expected_delay, atol=1e-5)
    assert delays[0] > 0.0

def test_flat_noise_snr_zero():
    # A flat profile should yield near zero SNR
    flat_data = np.ones((1, 1, 64)) * 10.0
    counts = np.ones((1, 1, 64), dtype=int)
    prof = Profile(data=flat_data, counts=counts, n_bins=64, period=0.1, dm=0.0)
    snr = calculate_snr(prof)
    assert snr == 0.0

def test_sharp_pulse_snr_high():
    np.random.seed(42)
    noisy_data = 2.0 + np.random.normal(0, 0.2, (1, 1, 64))
    noisy_data[0, 0, 16] = 20.0
    counts = np.ones((1, 1, 64), dtype=int)
    prof_noisy = Profile(data=noisy_data, counts=counts, n_bins=64, period=0.1, dm=0.0)
    snr_noisy = calculate_snr(prof_noisy)
    assert snr_noisy > 15.0
