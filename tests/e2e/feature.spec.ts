import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("A submits, B sees A on roster; reveal phase shows A's story", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    // Wait for slot inputs to be rendered.
    await a.locator(".mad-slot input").first().waitFor();
    const aSlots = a.locator(".mad-slot input");
    const count = await aSlots.count();
    for (let i = 0; i < count; i++) {
      await aSlots.nth(i).fill(`word${i}`);
    }
    await a.getByRole("button", { name: "✓ submit blindly", exact: true }).click();

    await expect(b.locator(".mad-roster li")).toContainText(["alice"]);

    await b.getByRole("button", { name: /reveal all stories/ }).click();

    await expect(a.locator(".mad-story-text")).toContainText("word0");
  } finally {
    await cleanup();
  }
});

// The advertised claim is "multi-peer ... blind slot fill and group reveal,
// mesh-synced". The test above only had ONE peer submit. This drives the full
// multi-peer loop: BOTH peers blind-fill their own slots, ONE peer triggers
// the group reveal, and the OTHER peer must then see BOTH rendered stories —
// proving every submission crosses the mesh AND the reveal phase is shared.
test("both peers blind-fill; group reveal shows every peer's rendered story", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    await a.locator(".mad-slot input").first().waitFor();
    await b.locator(".mad-slot input").first().waitFor();

    // Both peers fill the same number of slots with peer-distinct words so we
    // can assert each peer's words end up in their own rendered story.
    const aSlots = a.locator(".mad-slot input");
    const bSlots = b.locator(".mad-slot input");
    const count = await aSlots.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await aSlots.nth(i).fill(`alpha${i}`);
      await bSlots.nth(i).fill(`bravo${i}`);
    }
    await a.getByRole("button", { name: "✓ submit blindly", exact: true }).click();
    await b.getByRole("button", { name: "✓ submit blindly", exact: true }).click();

    // Both submissions must reach BOTH rosters (mesh-synced shared map).
    await expect(a.locator(".mad-roster")).toContainText("alice");
    await expect(a.locator(".mad-roster")).toContainText("bob");
    await expect(b.locator(".mad-roster")).toContainText("alice");
    await expect(b.locator(".mad-roster")).toContainText("bob");

    // Peer A triggers the group reveal — the phase flip must propagate to B.
    await a.getByRole("button", { name: /reveal all stories/ }).click();

    // On the OPPOSITE peer (B), both rendered stories appear, each carrying the
    // submitter's own blind-filled words — alice's story has alpha*, bob's has
    // bravo*. This is the load-bearing multi-peer cross-mesh assertion.
    await expect(b.locator(".mad-stories")).toBeVisible();
    const aliceStory = b
      .locator(".mad-story", { hasText: "alice's version" })
      .locator(".mad-story-text");
    const bobStory = b
      .locator(".mad-story", { hasText: "bob's version" })
      .locator(".mad-story-text");
    await expect(aliceStory).toContainText("alpha0");
    await expect(bobStory).toContainText("bravo0");
    // Cross-contamination guard: alice's story must NOT contain bob's words.
    await expect(aliceStory).not.toContainText("bravo0");
  } finally {
    await cleanup();
  }
});
