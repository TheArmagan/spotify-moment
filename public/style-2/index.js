const fac = new FastAverageColor();

const app = new Vue({
  el: "#vue-app",
  data: {
    state: {}
  },
  mounted() {
    setInterval(async () => {
      if (!await this.getAuthState()) return;
      const state = await this.getState();
      if (!((state || {}).item || {}).id) return;

      this.state = state;
    }, 1000);
  },
  methods: {
    async getState() {
      let state = await fetch("/api/state").then((d) => d.json());
      return state;
    },
    async getAuthState() {
      let state = await fetch("/api/auth/state").then((d) => d.json());
      return state.state;
    },
    percentage(partialValue, totalValue) {
      return (100 * partialValue) / totalValue;
    },
    sleep: function (ms = 100) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }
  }
})