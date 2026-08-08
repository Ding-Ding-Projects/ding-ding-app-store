# Calc

## Behavior

Calc provides editable sheets, cell selection, formula bar, sheet creation, and safe formulas for arithmetic, references, ranges, `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT`. CSV export reflects stored raw values.

## Configuration

Sheets, active cell, raw formulas, formats, zoom, search, and tab state persist with the workspace.

## Failure modes

Cycles, division by zero, unknown names, invalid references, and type errors remain explicit spreadsheet errors. Unsupported office functions are never evaluated as JavaScript.

## Security

The parser tokenizes and evaluates a bounded grammar without `eval` or `Function`. Formula text never leaves the device.

## Verification

Renderer tests cover precedence, right-associative powers, ranges, Unicode strings, cycles, error propagation, and JavaScript-injection attempts.

## Suggested articles

[UNO command broker](app-doc://article/material-office.repository.750ba92edbfaf886) · [Version history](app-doc://article/material-office.repository.62978229518ad58e) · [Tabs and search](app-doc://article/material-office.repository.477a1072906b827c)
