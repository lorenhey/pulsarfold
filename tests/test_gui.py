import pytest
from PySide6.QtWidgets import QApplication
from pulsarfold.gui.main_window import MainWindow

@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    yield app

def test_gui_smoke(qapp):
    window = MainWindow()
    assert window is not None
    assert window.windowTitle() == "PulsarFold"
    window.close()
