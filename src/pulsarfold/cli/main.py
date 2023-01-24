import argparse
import sys
import os
import yaml
from pulsarfold.core.observation import Observation
from pulsarfold.export.save import save_manifest, export_scientific_figures

def inspect(args):
    obs = Observation.load(args.file, args.format)
    print(f"File: {obs.file_path}")
    print(f"Source: {obs.source_name}")
    print(f"Format: {obs.file_format}")
    print(f"Duration: {obs.duration}")
    print(f"Bandwidth: {obs.bandwidth} centered at {obs.center_frequency}")
    print(f"Samples: {obs.n_samples}, Channels: {obs.n_channels}")

def process_batch(args):
    """Run a batch processing job from a YAML file."""
    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)
        
    for job in config.get('jobs', []):
        obs = Observation.load(job['input'])
        
        if job.get('rfi_auto', False):
            obs = obs.auto_mask()
            
        dm = job.get('dm', 0.0)
        if dm > 0:
            obs = obs.dedisperse(dm=dm)
            
        period = job.get('period')
        if not period:
            print("Skipping job, no period defined.")
            continue
            
        n_bins = job.get('n_bins', 64)
        profile = obs.fold(period=period, dm=dm, n_bins=n_bins, n_subints=16, n_subbands=16)
        
        output_dir = job.get('output_dir', '.')
        prefix = job.get('prefix', 'output')
        
        export_scientific_figures(output_dir, prefix, profile, obs)
        save_manifest(os.path.join(output_dir, f"{prefix}_manifest.yaml"), obs, profile)
        print(f"Processed {job['input']} -> {output_dir}/{prefix}")

def gui(args):
    try:
        from pulsarfold.gui.app import main as gui_main
        gui_main(args.file)
    except ImportError as e:
        print(f"Could not start GUI: {e}")
        print("Ensure PySide6 and pyqtgraph are installed.")

def main():
    parser = argparse.ArgumentParser(description="PulsarFold: Compact Pulsar Workbench")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # inspect command
    p_inspect = subparsers.add_parser("inspect", help="Inspect an observation file")
    p_inspect.add_parser_common = True
    p_inspect.add_argument("file", help="Path to observation file")
    p_inspect.add_argument("--format", default="auto", help="File format")
    
    # batch command
    p_batch = subparsers.add_parser("batch", help="Run batch processing from config")
    p_batch.add_argument("config", help="Path to YAML config file")
    
    # gui command
    p_gui = subparsers.add_parser("gui", help="Launch the interactive GUI")
    p_gui.add_argument("file", nargs="?", default=None, help="Optional file to open")
    
    args = parser.parse_args()
    
    if args.command == "inspect":
        inspect(args)
    elif args.command == "batch":
        process_batch(args)
    elif args.command == "gui":
        gui(args)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
