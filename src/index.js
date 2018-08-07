import Vue from 'vue'

export const dataFairStore = {
  namespaced: true,
  state: {
    ready: false,
    dataFairConfig: window.DATA_FAIR_CONFIG,
    env: null,
    appConfig: null,
    appDef: null,
    datasets: {},
    remoteServices: {}
  },
  getters: {
    defaultDataFairUrl(state) {
      return new URL(state.env.defaultDataFair)
    },
    defaultConfigureUrl(state) {
      return state.env.defaultDataFair + '/applications?import=' + encodeURIComponent(window.location.href)
    }
  },
  mutations: {
    setAny(state, params) {
      Object.assign(state, params)
    },
    setDataset(state, {key, dataset}) {
      Vue.set(state.datasets, key, dataset)
    },
    setRemoteService(state, {key, remoteService}) {
      Vue.set(state.remoteServices, key, remoteService)
    }
  },
  actions: {
    notif({dispatch}, notif) {
      dispatch('notification/queue', notif, {root: true})
    },
    async init({state, commit, dispatch}, {env}) {
      commit('setAny', {env})

      if (state.dataFairConfig) {
        // hackish way of exposing a nuxt application on various base urls
        const exposedUrl = new URL(state.dataFairConfig.exposedUrl)
        this.$router.options.base = exposedUrl.pathname
        this.$router.history.base = exposedUrl.pathname

        // Also init the session store using session routes from data-fair
        dispatch('session/init', {baseUrl: state.dataFairConfig.dataFairUrl + '/api/v1/session'}, {root: true})
        dispatch('session/loop', null, {root: true})

        // And the notification look
        dispatch('notification/loop', null, {root: true})

        // Handy base url for axios : the base of data-fair's api
        this.$axios.defaults.baseURL = state.dataFairConfig.dataFairUrl + '/api/v1'

        await Promise.all([dispatch('fetchAppDef'), dispatch('fetchAppConfig')])
      }

      commit('setAny', {ready: true})
    },
    async fetchAppDef({state, commit, dispatch}) {
      try {
        const appDef = await this.$axios.$get(`/applications/${state.dataFairConfig.applicationId}`)
        commit('setAny', {appDef})
      } catch (error) {
        dispatch('notif', {error, msg: `Erreur pendant la récupération des informations de l'application`})
      }
    },
    async fetchAppConfig({state, commit, dispatch}) {
      try {
        const appConfig = await this.$axios.$get(`/applications/${state.dataFairConfig.applicationId}/configuration`)
        appConfig.datasets = appConfig.datasets || []
        appConfig.remoteServices = appConfig.remoteServices || []
        commit('setAny', {appConfig})
      } catch (error) {
        dispatch('notif', {error, msg: `Erreur pendant la récupération de la configuration de l'application`})
      }
    },
    async saveAppConfig({state, commit, dispatch}, appConfig) {
      try {
        await this.$axios.$put(`/applications/${state.dataFairConfig.applicationId}/configuration`, appConfig)
        commit('setAny', {appConfig})
        dispatch('notif', {msg: `La configuration de l'application est enregistrée`})
      } catch (error) {
        dispatch('notif', {error, msg: `Erreur pendant l'enregistrement de la configuration de l'application`})
      }
    },
    async fetchDatasets({state, commit, dispatch}) {
      for (let datasetRef of state.appConfig.datasets) {
        try {
          commit('setDataset', {key: datasetRef.key, dataset: await this.$axios.$get(datasetRef.href)})
        } catch (error) {
          dispatch('notif', {error, msg: `Erreur pendant la récupération des informations du jeu de données`})
        }
      }
    },
    async fetchRemoteServices({state, commit, dispatch}) {
      for (let remoteServiceRef of state.appConfig.remoteServices) {
        try {
          commit('setRemoteService', {key: remoteServiceRef.key, remoteService: await this.$axios.$get(remoteServiceRef.href)})
        } catch (error) {
          dispatch('notif', {error, msg: `Erreur pendant la récupération des informations du service distant`})
        }
      }
    }
  }
}
