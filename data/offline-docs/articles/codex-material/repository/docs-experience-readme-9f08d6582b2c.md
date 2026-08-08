# Experience

How the app talks to the person using it, and how it behaves for people who do not use it the way
its author does.

| Page | What it covers |
| --- | --- |
| [Language modes](app-doc://article/codex-material.repository.2637d041ae1cdd3c) | English / 廣東話 / bilingual, the two independent funny sliders, voice-not-facts, the spoken narrator, the disclosure |
| [Accessibility](app-doc://article/codex-material.repository.89891138dfc32b4e) | Keyboard reachability, visible focus, roles / names / states, contrast, reduced motion, screen readers — with an honest audit of the current gaps |
| [Changelog viewer](app-doc://article/codex-material.repository.be49dd2f17bd0e2c) | The in-app changelog: every released version, date filtering, search wired to the regex builder, export |
| [Dim sum surprise](app-doc://article/codex-material.repository.969e37c6213888dd) | The 1 % launch delight — a randomly chosen dish, named in both languages, non-blocking and switchable off |

## The principle underneath all four

**Style is negotiable; facts are not.**

A message may be written playfully or plainly depending on the user's funny level, in English or
Cantonese or both depending on their language mode, and spoken aloud or not depending on the
narrator setting. Across every one of those combinations it must still name:

- what happened or is about to happen,
- what is affected — which file, which account, which tabs, how many,
- whether it can be undone,
- and what the user's options are.

A warning nobody can act on is a broken warning, not a funny one. This applies with no exemptions
to errors, destructive confirmations, security copy and accessibility copy — which is exactly why
the app tells the user, up front, that the setting affects those categories too.
