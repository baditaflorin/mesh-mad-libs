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
