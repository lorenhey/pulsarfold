import os
from pulsarfold.core.observation import Observation
from pulsarfold.io.sigproc import load_sigproc

def load_observation(file_path: str, file_format: str = 'auto') -> Observation:
    if file_format == 'auto':
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.fil':
            file_format = 'sigproc'
        else:
            raise ValueError(f"Could not automatically determine format for {file_path}")
            
    if file_format.lower() == 'sigproc':
        return load_sigproc(file_path)
    else:
        raise NotImplementedError(f"Format {file_format} not supported yet")
