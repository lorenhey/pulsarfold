import sys
from PySide6.QtWidgets import QApplication
from pulsarfold.gui.main_window import MainWindow

def main(initial_file=None):
    app = QApplication(sys.argv)
    window = MainWindow(initial_file)
    window.show()
    sys.exit(app.exec())
