"""How a cell value is written on a page."""


def show(value):
    if value is None or value == "":
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, float):
        return str(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return str(value)
