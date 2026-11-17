---
'@eleoptics/plots-svelte': patch
---

A wrapper whose options change what its pointer action is made of (a callback or `values` turning on or off) keeps keyboard focus: the action now binds the new call before it stops the old one, so the box keeps its `tabindex`.
