import os
from pulsarfold.io.synthetic import generate_synthetic_pulsar
from pulsarfold.export.save import export_scientific_figures, save_manifest

def main():
    print("Generating synthetic observation...")
    obs = generate_synthetic_pulsar(
        duration=10.0,
        period=0.1,
        dm=50.0,
        snr_per_pulse=3.0,
        fch1=1500.0,
        n_channels=64
    )
    
    print("Applying auto mask...")
    obs = obs.auto_mask()
    
    print("Dedispersing...")
    obs = obs.dedisperse(dm=50.0)
    
    print("Folding...")
    profile = obs.fold(period=0.1, n_bins=128, n_subints=16, n_subbands=16)
    
    output_dir = "example_output"
    print(f"Exporting results to {output_dir}/...")
    export_scientific_figures(output_dir, "synth", profile, obs)
    save_manifest(os.path.join(output_dir, "manifest.yaml"), obs, profile)
    print("Done!")

if __name__ == "__main__":
    main()
