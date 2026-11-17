---
'@eleoptics/plots': patch
---

`interact()`'s `stop()` restores the `tabindex` it added: the last live call on a host to stop removes it, if it is still `"0"`.
