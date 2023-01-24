import sys
import numpy as np
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QLineEdit, QPushButton, QFileDialog, QSplitter, QFormLayout, 
    QTabWidget, QMessageBox
)
from PySide6.QtCore import Qt, QThread, Signal
import pyqtgraph as pg

from pulsarfold.core.observation import Observation
from pulsarfold.io.dispatch import load_observation
from pulsarfold.folding.fold import fold
from pulsarfold.export.save import save_manifest, export_scientific_figures

class WorkerThread(QThread):
    finished = Signal(object)
    error = Signal(str)

    def __init__(self, func, *args, **kwargs):
        super().__init__()
        self.func = func
        self.args = args
        self.kwargs = kwargs

    def run(self):
        try:
            result = self.func(*self.args, **self.kwargs)
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))

class MainWindow(QMainWindow):
    def __init__(self, initial_file=None):
        super().__init__()
        self.setWindowTitle("PulsarFold")
        self.resize(1200, 800)
        
        self.obs = None
        self.folded_profile = None
        
        self.init_ui()
        
        if initial_file:
            self.load_file(initial_file)

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        
        # Splitter for sidebar and main area
        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)
        
        # Sidebar
        sidebar = QWidget()
        sidebar_layout = QVBoxLayout(sidebar)
        
        # File operations
        btn_open = QPushButton("Open Observation")
        btn_open.clicked.connect(self.on_open_clicked)
        sidebar_layout.addWidget(btn_open)
        
        btn_export = QPushButton("Export Results")
        btn_export.clicked.connect(self.on_export_clicked)
        sidebar_layout.addWidget(btn_export)
        
        # Info panel
        self.info_label = QLabel("No data loaded")
        self.info_label.setWordWrap(True)
        sidebar_layout.addWidget(self.info_label)
        
        # Controls
        controls_layout = QFormLayout()
        
        self.dm_input = QLineEdit("0.0")
        controls_layout.addRow("DM:", self.dm_input)
        
        self.period_input = QLineEdit("0.1")
        controls_layout.addRow("Period (s):", self.period_input)
        
        btn_process = QPushButton("Process (Dedisperse & Fold)")
        btn_process.clicked.connect(self.on_process_clicked)
        
        sidebar_layout.addLayout(controls_layout)
        sidebar_layout.addWidget(btn_process)
        sidebar_layout.addStretch()
        
        # Main Area Tabs
        self.tabs = QTabWidget()
        
        # Tab 1: Waterfall
        self.waterfall_widget = pg.ImageView()
        self.waterfall_widget.ui.histogram.hide()
        self.waterfall_widget.ui.roiBtn.hide()
        self.waterfall_widget.ui.menuBtn.hide()
        self.tabs.addTab(self.waterfall_widget, "Waterfall (Time vs Freq)")
        
        # Tab 2: Profile (1D)
        self.profile_plot = pg.PlotWidget(title="Folded Profile")
        self.tabs.addTab(self.profile_plot, "Profile")
        
        # Tab 3: Phase vs Time
        self.phase_time_img = pg.ImageView()
        self.phase_time_img.ui.histogram.hide()
        self.phase_time_img.ui.roiBtn.hide()
        self.phase_time_img.ui.menuBtn.hide()
        self.tabs.addTab(self.phase_time_img, "Phase vs Time")
        
        # Tab 4: Phase vs Frequency
        self.phase_freq_img = pg.ImageView()
        self.phase_freq_img.ui.histogram.hide()
        self.phase_freq_img.ui.roiBtn.hide()
        self.phase_freq_img.ui.menuBtn.hide()
        self.tabs.addTab(self.phase_freq_img, "Phase vs Freq")
        
        splitter.addWidget(sidebar)
        splitter.addWidget(self.tabs)
        splitter.setSizes([250, 950])

    def on_open_clicked(self):
        file_name, _ = QFileDialog.getOpenFileName(self, "Open Observation", "", "Filterbank (*.fil);;All Files (*)")
        if file_name:
            self.load_file(file_name)

    def load_file(self, file_path):
        self.info_label.setText("Loading...")
        # Doing this synchronously for simplicity, but could be threaded
        try:
            self.obs = load_observation(file_path)
            self.update_info()
            self.render_waterfall()
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to load file:\n{e}")
            self.info_label.setText("Error loading file")

    def update_info(self):
        if not self.obs:
            return
        info = (
            f"Source: {self.obs.source_name}\n"
            f"Start: {self.obs.start_time}\n"
            f"Duration: {self.obs.duration}\n"
            f"Samples: {self.obs.n_samples}\n"
            f"Channels: {self.obs.n_channels}\n"
            f"Bandwidth: {self.obs.bandwidth}\n"
        )
        self.info_label.setText(info)

    def render_waterfall(self):
        if not self.obs or self.obs.data is None:
            return
            
        # Decimate for viewing if too large
        data = self.obs.data
        max_points = 2000
        
        if data.shape[0] > max_points:
            step = data.shape[0] // max_points
            data = data[::step, :]
            
        # ImageView expects (x, y) = (time, freq). Data is (time, freq).
        # We need to transpose depending on how we want to view it.
        # Often freq is Y and time is X.
        img_data = data.T # (freq, time)
        
        # Fast render
        self.waterfall_widget.setImage(img_data, autoRange=True, autoLevels=True)
        self.tabs.setCurrentIndex(0)

    def on_process_clicked(self):
        if not self.obs:
            return
            
        try:
            dm = float(self.dm_input.text())
            period = float(self.period_input.text())
        except ValueError:
            QMessageBox.warning(self, "Input Error", "Please enter valid numbers for DM and Period")
            return
            
        self.info_label.setText("Processing...")
        
        # Process in thread
        self.worker = WorkerThread(self.process_pipeline, self.obs, dm, period)
        self.worker.finished.connect(self.on_process_finished)
        self.worker.error.connect(self.on_process_error)
        self.worker.start()

    def process_pipeline(self, obs, dm, period):
        # Auto mask (simple)
        obs_masked = obs.auto_mask()
        
        # Dedisperse
        if dm > 0:
            obs_dd = obs_masked.dedisperse(dm)
        else:
            obs_dd = obs_masked
            
        # Fold
        profile = obs_dd.fold(period=period, n_bins=128, n_subints=32, n_subbands=32)
        return profile

    def on_process_finished(self, profile):
        self.folded_profile = profile
        self.info_label.setText("Processing complete.")
        
        # Update plots
        self.profile_plot.clear()
        p1d = profile.get_1d_profile()
        phase = np.linspace(0, 2, len(p1d)*2, endpoint=False)
        p1d_2c = np.concatenate([p1d, p1d])
        self.profile_plot.plot(phase, p1d_2c, pen='y')
        
        self.phase_time_img.setImage(np.hstack([profile.get_time_phase(), profile.get_time_phase()]).T)
        self.phase_freq_img.setImage(np.hstack([profile.get_freq_phase(), profile.get_freq_phase()]).T)
        
        self.tabs.setCurrentIndex(1) # Show profile

    def on_process_error(self, err_msg):
        QMessageBox.critical(self, "Processing Error", f"An error occurred:\n{err_msg}")
        self.info_label.setText("Processing failed.")
        
    def on_export_clicked(self):
        if not self.obs or not self.folded_profile:
            QMessageBox.warning(self, "Export Error", "Nothing to export. Process data first.")
            return
            
        dir_name = QFileDialog.getExistingDirectory(self, "Select Export Directory")
        if dir_name:
            try:
                export_scientific_figures(dir_name, "pulsarfold_out", self.folded_profile, self.obs)
                save_manifest(f"{dir_name}/manifest.yaml", self.obs, self.folded_profile)
                QMessageBox.information(self, "Success", f"Exported successfully to {dir_name}")
            except Exception as e:
                QMessageBox.critical(self, "Export Error", str(e))
