<!-- The frame every analysis sits in: title, meta, color key and actions above; the plot; legend and statistics below. -->
<script>
  /** @type {{ title: string, meta?: string, colorKey?: string, paper?: boolean, compact?: boolean, selected?: boolean,
   *   state?: 'ready' | 'loading' | 'empty' | 'error' | 'stale', message?: string,
   *   actions?: import('svelte').Snippet, footer?: import('svelte').Snippet, children?: import('svelte').Snippet }} */
  let { title, meta, colorKey, paper = false, compact = false, selected = false, state = 'ready', message, actions, footer, children } = $props();
</script>

<section class="eleo-plot" class:eleo-plot--compact={compact} class:eleo-plot--selected={selected}
  data-state={state === 'ready' ? undefined : state} data-theme={paper ? 'light' : undefined}>
  <div class="eleo-plot__hd">
    <h3 class="eleo-plot__title">{title}</h3>
    {#if meta}<span class="eleo-plot__meta">{meta}</span>{/if}
    {#if colorKey}<span class="eleo-plot__key">{colorKey}</span>{/if}
    {#if actions && !compact}<div class="eleo-plot__actions">{@render actions()}</div>{/if}
  </div>
  {#if state === 'ready' || state === 'stale'}
    <div class="eleo-plot__body">{@render children?.()}</div>
  {:else}
    <div class="eleo-plot__msg" role={state === 'error' ? 'alert' : 'status'}>{#if message}<span>{message}</span>{/if}</div>
  {/if}
  {#if footer}<div class="eleo-plot__ft">{@render footer()}</div>{/if}
</section>
