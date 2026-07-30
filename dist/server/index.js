export default {
  async fetch(request, environment) {
    if (environment.ASSETS) return environment.ASSETS.fetch(request);
    return new Response("網站資源尚未完成部署。", { status: 503 });
  }
};
