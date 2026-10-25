"""Turn finished rows of strings into a page.

The password check is in the page itself. A static file host is enough.
The password is visible to anyone who can read the file.
"""

import html

PASSWORD = "tomat"


def render_html(title, sections, intro=""):
    """Write a page. Each section is a heading plus rows of cell strings.

    The first row of a section is the header row.
    """
    body = [f"<h1>{html.escape(title)}</h1>"]
    if intro:
        body.append(f"<p>{html.escape(intro)}</p>")
    for heading, rows in sections:
        if heading:
            body.append(f"<h2>{html.escape(heading)}</h2>")
        body.append("<table>")
        for index, row in enumerate(rows):
            tag = "th" if index == 0 else "td"
            cells = "".join(f"<{tag}>{html.escape(cell)}</{tag}>" for cell in row)
            body.append(f"<tr>{cells}</tr>")
        body.append("</table>")
    return _page(title, body)


def render_index(title, groups, generated):
    """Write the index. Each group is (heading, totals path, family links).

    A family link is (label, path). ``generated`` is when these pages were made.
    """
    body = [f"<h1>{html.escape(title)}</h1>"]
    body.append(f"<p>{html.escape(generated)}</p>")
    body.append('<p><a href="picking.html">Picking list</a></p>')
    for heading, totals_path, families in groups:
        body.append(f"<h2>{html.escape(heading)}</h2>")
        body.append(f'<p><a href="{html.escape(totals_path)}">Totals</a></p>')
        body.append("<ul>")
        for label, path in families:
            body.append(
                f'<li><a href="{html.escape(path)}">{html.escape(label)}</a></li>'
            )
        body.append("</ul>")
    return _page(title, body)


def _page(title, body):
    parts = _document_start(title)
    parts.append('<form id="gate">')
    parts.append(
        '<p><label>Lösenord <input type="password" name="password" autofocus></label></p>'
    )
    parts.append("<p><button>Öppna</button></p>")
    parts.append('<p id="gate-wrong" hidden>Fel lösenord.</p>')
    parts.append("</form>")
    parts.append('<div id="page">')
    parts.extend(body)
    parts.append("</div>")
    parts.append("<script>")
    parts.append(
        "document.getElementById('gate').addEventListener('submit', function (event) {"
    )
    parts.append("  event.preventDefault();")
    parts.append(
        f"  if (new FormData(event.target).get('password') === {PASSWORD!r}) {{"
    )
    parts.append("    try { localStorage.setItem('csa-open', '1'); } catch (error) {}")
    parts.append("    document.documentElement.classList.add('open');")
    parts.append("  } else {")
    parts.append("    document.getElementById('gate-wrong').hidden = false;")
    parts.append("  }")
    parts.append("});")
    parts.append("</script>")
    parts.append("</body></html>")
    return "\n".join(parts) + "\n"


def _document_start(title):
    return [
        "<!DOCTYPE html>",
        '<html lang="sv">',
        "<head>",
        '<meta charset="utf-8">',
        f"<title>{html.escape(title)}</title>",
        "<script>",
        "try {",
        "  if (localStorage.getItem('csa-open') === '1') document.documentElement.classList.add('open');",
        "} catch (error) {}",
        "</script>",
        "<style>",
        "body { font-family: Georgia, serif; margin: 1.5rem; }",
        "p { white-space: pre-wrap; max-width: 40rem; }",
        "input, button { font: inherit; }",
        "#page { display: none; }",
        "html.open #gate { display: none; }",
        "html.open #page { display: block; }",
        "table { border-collapse: collapse; margin: 0 0 2rem; }",
        "th, td { border: 1px solid #ccc; padding: 0.3rem 0.6rem; vertical-align: top; }",
        "td:first-child { white-space: pre-wrap; max-width: 36rem; }",
        "td:not(:first-child), th:not(:first-child) { text-align: center; }",
        "</style>",
        "</head>",
        "<body>",
    ]
