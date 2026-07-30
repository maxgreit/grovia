"""
Gedeelde testhulp: laadt een Azure Function-module onder een unieke naam.

Elke function-map heeft een __init__.py. Met `sys.path.insert` + `import __init__`
geeft Python bij de tweede import de eerste module terug uit sys.modules, waardoor
tests elkaar besmetten. Deze loader geeft elke module een eigen naam.
"""
import importlib.util
import os
import sys

WORTEL = os.path.join(os.path.dirname(__file__), '..')


def laad_function_module(mapnaam: str):
    """
    Laad de __init__.py van een Azure Function-map als losse module.

    Args:
        mapnaam: naam van de function-map, bijv. 'ixly-status'

    Returns:
        De geladen module. De modulenaam is 'grovia_test_<mapnaam met _>'.
    """
    bestand = os.path.join(WORTEL, mapnaam, '__init__.py')
    modulenaam = 'grovia_test_' + mapnaam.replace('-', '_')

    spec = importlib.util.spec_from_file_location(modulenaam, bestand)
    module = importlib.util.module_from_spec(spec)
    # Registreer in sys.modules zodat @patch("modulenaam....") de module kan
    # vinden via importlib.import_module — anders faalt de patch met
    # ModuleNotFoundError, ook al bestaat het module-object al.
    sys.modules[modulenaam] = module
    spec.loader.exec_module(module)
    return module
