# Delivery documentation

| Feature | Contract | Status |
| --- | --- | --- |
| Windows releases | [Release pipeline](app-doc://article/jdownloader-material.repository.95750631ecbd4428) | Implemented locally; remote proof pending |
| Pages and wiki | [Pages and wiki](app-doc://article/jdownloader-material.repository.c3cbc55b4d51b11a) | Tabbed source implemented locally; remote proof pending |
| Test evidence | [Verification](app-doc://article/jdownloader-material.repository.02f19cac510ee90e) | Dynamic smoke gate implemented locally; remote proof pending |

Delivery is successful only when tests pass before publication, one new immutable release is
published for the qualifying run, the release contains exactly one real Windows x64 EXE and one
bundled dim-sum image, Pages deploys verified tabbed source, the wiki is synchronized, and the
pushed default branch contains the intended commit.

No HTTP/Postman artifacts belong here. See [API applicability](app-doc://article/jdownloader-material.repository.ac0e4a04bf399f08).
