const url = new URL(window.location.href);
const app = new Vue({
  el: "#vue-app",
  data: {
    state: {},
    mainHidden: true,
    doNotHide: url.searchParams.has("doNotHide"),
    pauseShow: false
  },
  mounted() {
    let lastTrackId = "";
    setInterval(async () => {
      if (!await this.getAuthState()) return;
      const state = await this.getState();
      if (!((state || {}).item || {}).id) return;

      if (state.item.id != ((this.state || {}).item || {}).id) {
        this.mainHidden = true;
        await this.sleep(300);
        this.mainHidden = false;
      }

      if (state.is_playing) {
        if (!this.doNotHide) {
          this.mainHidden = false
        } else {
          this.pauseShow = false
        }
      } else {
        if (!this.doNotHide) {
          this.mainHidden = true
        } else {
          this.pauseShow = true
        }
      }


      if (state.is_playing && !this.doNotHide) {
        this.mainHidden = false;
      }
      this.state = state;
    }, 1000)
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
});