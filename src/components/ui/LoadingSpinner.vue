<script setup>
defineProps({ size: { type: String, default: 'md' } })
</script>

<template>
  <div class="flex items-center justify-center">
    <svg
      :class="{ 'w-5 h-5': size === 'sm', 'w-8 h-8': size === 'md', 'w-12 h-12': size === 'lg' }"
      class="animate-spin text-amber-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
</template>
