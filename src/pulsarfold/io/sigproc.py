import struct
import numpy as np
from typing import Dict, Any, Tuple
from astropy.time import Time
import astropy.units as u
from pulsarfold.core.observation import Observation

def _read_string(f) -> str:
    len_struct = f.read(4)
    if not len_struct or len(len_struct) < 4:
        return ""
    length = struct.unpack('I', len_struct)[0]
    if length > 80 or length == 0:  # arbitrary sanity check for sigproc keys
        return ""
    s = f.read(length).decode('ascii', errors='ignore')
    return s

def _read_header(f) -> Tuple[Dict[str, Any], int]:
    header = {}
    keyword = _read_string(f)
    if keyword != "HEADER_START":
        raise ValueError("Not a valid SIGPROC file: Missing HEADER_START")

    while True:
        keyword = _read_string(f)
        if keyword == "HEADER_END":
            break
        elif keyword in ["source_name", "rawdatafile"]:
            header[keyword] = _read_string(f)
        elif keyword in ["machine_id", "telescope_id", "data_type", "nchans", "nbits", "nifs", "barycentric", "pulsarcentric"]:
            header[keyword] = struct.unpack('I', f.read(4))[0]
        elif keyword in ["tstart", "tsamp", "fch1", "foff", "refdm", "az_start", "za_start", "src_raj", "src_dej"]:
            header[keyword] = struct.unpack('d', f.read(8))[0]
        else:
            # Unknown keyword, try to skip if possible? SIGPROC makes this hard if we don't know the type.
            pass
            
    return header, f.tell()

def load_sigproc(file_path: str) -> Observation:
    """
    Loads a SIGPROC filterbank file into an Observation object.
    Uses memory mapping for the data to avoid blowing up RAM.
    """
    import os
    import hashlib
    
    with open(file_path, 'rb') as f:
        header, hdr_len = _read_header(f)

    # Calculate file hash for provenance (read first 1MB for speed)
    file_hash = hashlib.sha256()
    with open(file_path, 'rb') as f:
        file_hash.update(f.read(1024*1024))
    hash_str = file_hash.hexdigest()

    file_size = os.path.getsize(file_path)
    data_size = file_size - hdr_len
    
    n_bits = header.get('nbits', 8)
    n_chans = header.get('nchans', 1)
    n_ifs = header.get('nifs', 1)
    
    bytes_per_sample = n_bits // 8
    if bytes_per_sample == 0: # e.g. 1-bit or 4-bit, skip for now or implement pack/unpack
        raise NotImplementedError("Only 8, 16, 32 bit sigproc currently supported")
        
    samples_per_block = n_chans * n_ifs
    bytes_per_block = samples_per_block * bytes_per_sample
    n_samples = data_size // bytes_per_block

    dtype_map = {8: np.uint8, 16: np.uint16, 32: np.float32}
    dtype = dtype_map.get(n_bits, np.uint8)

    # Memory map the data
    data = np.memmap(file_path, dtype=dtype, mode='r', offset=hdr_len, shape=(n_samples, n_chans))
    
    # Extract metadata safely
    start_time = None
    if 'tstart' in header:
        start_time = Time(header['tstart'], format='mjd', scale='utc')
        
    sample_time = None
    if 'tsamp' in header:
        sample_time = header['tsamp'] * u.s
        
    center_freq = None
    bandwidth = None
    if 'fch1' in header and 'foff' in header:
        fch1 = header['fch1'] * u.MHz
        foff = header['foff'] * u.MHz
        bandwidth = np.abs(foff.value) * n_chans * u.MHz
        # SIGPROC fch1 is the center of the first channel
        center_freq = fch1 + (n_chans / 2 - 0.5) * foff

    obs = Observation(
        source_name=header.get('source_name'),
        file_path=file_path,
        file_hash=hash_str,
        file_format="SIGPROC Filterbank",
        start_time=start_time,
        sample_time=sample_time,
        n_samples=n_samples,
        center_frequency=center_freq,
        bandwidth=bandwidth,
        n_channels=n_chans,
        data=data
    )
    
    # Overwrite channel frequencies to be exact from sigproc fch1, foff
    if 'fch1' in header and 'foff' in header:
        obs.channel_frequencies = header['fch1'] * u.MHz + np.arange(n_chans) * header['foff'] * u.MHz
        
    obs.add_history("load_file", {"file_path": file_path, "format": "sigproc"})
    return obs
