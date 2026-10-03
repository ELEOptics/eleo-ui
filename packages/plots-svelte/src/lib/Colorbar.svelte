<!-- A colorbar for a Map2D: the brand maps follow the theme through their CSS variables. -->
<script>
  import { gradient } from '@eleoptics/plots';
  /** @type {{ map?: 'ember' | 'wave' | 'viridis' | 'gray', labels?: string[], horizontal?: boolean }} */
  let { map = 'ember', labels = [], horizontal = false } = $props();
</script>

<div class="eleo-colorbar" class:eleo-colorbar--h={horizontal}>
  <i style:background={gradient(map, horizontal ? 'to right' : 'to top')}></i>
  <span>{#each labels as l}<b style="font-weight:400">{l}</b>{/each}</span>
</div>
