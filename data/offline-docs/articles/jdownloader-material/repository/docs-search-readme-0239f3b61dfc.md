# Search

| Feature | Contract | Status |
| --- | --- | --- |
| Safe evaluator and builder | [Regex builder](app-doc://article/jdownloader-material.repository.53ab314906de854a) | Implemented |
| Desktop search surfaces | [Search integration](app-doc://article/jdownloader-material.repository.b5f4509d7338e977) | Implemented |

All desktop search fields use RE2/J 1.8 through the same bounded evaluator. Plain-text matching is
the default; each field owns its own adjacent anchored builder, expression, flags, validation and
mode.
