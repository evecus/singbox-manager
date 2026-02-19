import { create } from 'zustand'
import { api } from './api'

export const useStore = create((set, get) => ({
  status: 'stopped',
  statusError: '',
  traffic: { up: 0, down: 0 },
  connections: [],
  logs: [],

  fetchStatus: async () => {
    try {
      const s = await api.getStatus()
      set({ status: s.status, statusError: s.error || '' })
    } catch {}
  },

  addLog: (entry) => set((state) => ({
    logs: [...state.logs.slice(-500), entry]
  })),

  setTraffic: (t) => set({ traffic: t }),
  setConnections: (c) => set({ connections: c }),
}))
