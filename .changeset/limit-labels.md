---
"@eleoptics/plots": patch
---

Fix: limit labels' offsets from their line and the frame scale with the label's text size, as the tick labels' do (they were fixed pixels, which crowded the text at wide widths).
