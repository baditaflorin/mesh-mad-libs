import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-mad-libs",
  description: "Multi-peer mad libs with blind slot fill and group reveal, no account, mesh-synced",
  accentHex: "#f97316",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
