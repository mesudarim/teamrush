<script setup>
import { ref } from 'vue'
import { migrateToMultiGame, verifyMigration, MIGRATION_GAME_ID } from '@/firebase/migration'

const logs       = ref([])
const running    = ref(false)
const done       = ref(false)
const verified   = ref(null)
const verifying  = ref(false)

const log = (msg) => logs.value.push(msg)

const runMigration = async () => {
  running.value = true
  logs.value = []
  done.value = false
  verified.value = null
  try {
    await migrateToMultiGame(log)
    done.value = true
  } catch (e) {
    log('❌ Error: ' + e.message)
  } finally {
    running.value = false
  }
}

const runVerify = async () => {
  verifying.value = true
  verified.value = null
  try {
    verified.value = await verifyMigration()
  } finally {
    verifying.value = false
  }
}

const allOk = (results) => results && Object.values(results).every(r => r.ok)
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="card-glow space-y-4">
      <h2 class="text-xl font-bold text-white">Migration vers multi-jeux</h2>
      <p class="text-slate-400 text-sm">
        Copie toutes les données existantes (participants, équipes, checkpoints, etc.)
        vers <code class="text-amber-400">/games/{{ MIGRATION_GAME_ID }}/</code>.
        Les données originales ne sont <strong class="text-white">pas supprimées</strong>.
      </p>

      <div class="flex gap-3">
        <button
          @click="runMigration"
          :disabled="running"
          class="btn-primary px-6 py-2 disabled:opacity-50"
        >
          {{ running ? 'Migration en cours...' : 'Lancer la migration' }}
        </button>
        <button
          v-if="done"
          @click="runVerify"
          :disabled="verifying"
          class="btn-secondary px-6 py-2 disabled:opacity-50"
        >
          {{ verifying ? 'Vérification...' : 'Vérifier' }}
        </button>
      </div>
    </div>

    <!-- Logs -->
    <div v-if="logs.length" class="card-glow">
      <h3 class="text-sm font-semibold text-slate-400 mb-3">Journal</h3>
      <pre class="text-xs text-slate-300 font-mono space-y-1 max-h-80 overflow-y-auto leading-5">
        <span v-for="(line, i) in logs" :key="i" class="block">{{ line }}</span>
      </pre>
    </div>

    <!-- Verification results -->
    <div v-if="verified" class="card-glow space-y-3">
      <h3 class="text-sm font-semibold text-slate-400">Résultats de vérification</h3>
      <div
        v-for="(result, col) in verified"
        :key="col"
        class="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0"
      >
        <span class="text-slate-300 text-sm">{{ col }}</span>
        <div class="flex items-center gap-4 text-sm">
          <span class="text-slate-500">Original: {{ result.original }}</span>
          <span class="text-slate-500">Migré: {{ result.migrated }}</span>
          <span :class="result.ok ? 'text-green-400' : 'text-red-400'">
            {{ result.ok ? '✓' : '✗ DIFFÉRENCE' }}
          </span>
        </div>
      </div>
      <div
        class="mt-3 p-3 rounded-lg text-sm font-semibold text-center"
        :class="allOk(verified) ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'"
      >
        {{ allOk(verified) ? '✓ Migration complète et vérifiée' : '✗ Des collections ne correspondent pas' }}
      </div>
    </div>

    <div class="text-xs text-slate-600 text-center">
      Cette page peut être retirée après la migration.
    </div>
  </div>
</template>
